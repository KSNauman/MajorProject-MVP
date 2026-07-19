import os
import sys
import json
import base64
import requests
import time
from dotenv import load_dotenv

def analyze_image(image_path):
    print(f"[*] Sending {image_path} to Gemini for classification...")
    
    # Load environment variables from core_engine/.env
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(env_path)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("[!] GEMINI_API_KEY not found in .env file")
        return None
        
    try:
        with open(image_path, "rb") as f:
            image_data = f.read()
    except Exception as e:
        print(f"[!] Could not open image: {e}")
        return None
        
    b64_img = base64.b64encode(image_data).decode("utf-8")
    mime_type = "image/png"
    if image_path.lower().endswith(".jpg") or image_path.lower().endswith(".jpeg"):
        mime_type = "image/jpeg"
    
    prompt = """
    Analyze this drawing. 
    1. Is it a humanoid (bipedal with 2 arms, 2 legs, 1 head)?
    2. Is it a wheeled vehicle (car, truck, bike)?
    3. If it is wheeled, find all the wheels. For each wheel, provide its center X, center Y, and radius. 
       CRITICAL: Provide these values as normalized floats between 0.0 and 1.0 (where 0.0 is top/left and 1.0 is bottom/right relative to the image dimensions).
    
    Respond strictly in this JSON schema:
    {
      "is_humanoid": false,
      "is_wheeled": true,
      "wheels": [
        {"x": 0.25, "y": 0.8, "radius": 0.1},
        {"x": 0.75, "y": 0.8, "radius": 0.1}
      ]
    }
    """
    
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": b64_img
                    }
                }
            ]
        }],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }

    models_to_try = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
    ]

    for model_name in models_to_try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        retries = 3
        delay = 1.5
        
        while retries > 0:
            print(f"[*] Attempting with model '{model_name}' ({retries} retries left)...")
            try:
                response = requests.post(url, json=payload)
                
                if response.status_code == 200:
                    data = response.json()
                    json_text = data['candidates'][0]['content']['parts'][0]['text']
                    print(f"[+] Success! Generated output using: {model_name}")
                    return json.loads(json_text)
                    
                elif response.status_code in [503, 429]:
                    if retries > 1:
                        print(f"[!] Transient error (HTTP {response.status_code}). Retrying in {delay}s...")
                        time.sleep(delay)
                        delay *= 2
                        retries -= 1
                    else:
                        print(f"[-] Model '{model_name}' failed completely (HTTP {response.status_code}).")
                        break
                elif response.status_code == 404:
                    print(f"[-] Model '{model_name}' is not available (HTTP 404).")
                    break # Model simply doesn't exist, try next
                else:
                    print(f"[-] Model '{model_name}' failed with HTTP {response.status_code}: {response.text}")
                    break # Not a transient error, move to next model
                    
            except Exception as e:
                print(f"[-] Unexpected error with model '{model_name}': {e}")
                break # Move to next model
                
    print("[❌] All available Gemini models failed or were unavailable.")
    return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python gemini_brain.py <image_path>")
    else:
        # Join all arguments just in case the user forgets to put quotes around paths with spaces
        image_path = " ".join(sys.argv[1:])
        result = analyze_image(image_path)
        if result:
            print("\n--- GEMINI CLASSIFICATION RESULT ---")
            print(json.dumps(result, indent=2))
            
            # Save to JSON file so the animator can use it
            output_json = image_path + ".json"
            with open(output_json, 'w') as f:
                json.dump(result, f, indent=2)
            print(f"\n[+] Saved coordinates to {output_json}")
