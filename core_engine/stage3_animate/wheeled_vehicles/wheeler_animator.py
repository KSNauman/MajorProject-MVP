import cv2
import numpy as np
from PIL import Image
import imageio
import sys
import os

def detect_wheels(cv_image):
    """Detects wheels using Hough Circles."""
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
    
    # Thresholding or edge enhancement can help drawings
    # But a simple blur is standard for Hough Circles
    gray_blurred = cv2.medianBlur(gray, 5)
    
    h, w = gray.shape
    
    # HoughCircles parameters tuned for drawings/sketches
    circles = cv2.HoughCircles(
        gray_blurred, 
        cv2.HOUGH_GRADIENT, 
        dp=1.2, 
        minDist=w/6, # Wheels are at least 1/6th of image width apart
        param1=50,    # Edge detection threshold
        param2=25,    # Accumulator threshold (lower = detects more circles)
        minRadius=int(h*0.05), # Wheel should be at least 5% of height
        maxRadius=int(h*0.35)  # Wheel shouldn't be bigger than 35% of height
    )
    
    valid_wheels = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for i in circles[0, :]:
            x, y, r = i[0], i[1], i[2]
            # Heuristic: Wheels are usually in the lower half of the vehicle
            if y > h * 0.4:
                valid_wheels.append((x, y, r))
                
    # Sort by x coordinate (left to right)
    valid_wheels.sort(key=lambda w: w[0])
    return valid_wheels

import json

def load_gemini_wheels(json_path, w, h):
    """Loads normalized wheel coordinates from Gemini JSON and converts to absolute pixels."""
    if not os.path.exists(json_path):
        return None
        
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        if not data.get("is_wheeled", False):
            print("[!] Gemini says this is not a wheeled vehicle.")
            return []
            
        wheels = []
        for wheel in data.get("wheels", []):
            # Gemini returns 0.0 - 1.0, we multiply by width/height
            x = int(wheel['x'] * w)
            y = int(wheel['y'] * h)
            # Use width for radius scaling to keep it proportional
            r = int(wheel['radius'] * w) 
            wheels.append((x, y, r))
        return wheels
    except Exception as e:
        print(f"[!] Error reading Gemini JSON: {e}")
        return None

def create_wheeler_animation(input_path, output_path):
    print(f"[*] Processing Wheeler Animation for {input_path}")
    
    # 1. Load image in OpenCV
    img_cv = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img_cv is None:
        print(f"[!] Error loading image: {input_path}")
        return False
        
    # Ensure BGRA (4 channels)
    if img_cv.shape[2] == 3:
        img_cv = cv2.cvtColor(img_cv, cv2.COLOR_BGR2BGRA)
        
    # Scale down if too big to ensure performance and reliable circle detection
    max_dim = 800
    h, w = img_cv.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img_cv = cv2.resize(img_cv, (int(w*scale), int(h*scale)))
        h, w = img_cv.shape[:2]

    # 2. Detect Wheels (Check for Gemini JSON first, fallback to OpenCV)
    json_path = input_path + ".json"
    wheels = load_gemini_wheels(json_path, w, h)
    
    if wheels:
        print(f"[*] Using {len(wheels)} wheels detected by Gemini AI.")
    else:
        print("[*] No Gemini data found. Falling back to OpenCV algorithmic detection...")
        wheels = detect_wheels(img_cv)
        
    if not wheels:
        print("[!] No wheels detected. Cannot animate.")
        return False
        
    print(f"[*] Proceeding with {len(wheels)} wheels.")

    
    # 3. Segmentation: Separate Body and Wheels
    # Convert OpenCV BGRA image to PIL RGBA for easy manipulation
    img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGRA2RGBA))
    
    wheel_images = []
    body_np = np.array(img_pil)
    
    for (x, y, r) in wheels:
        # Create mask for the wheel
        mask = np.zeros((h, w), dtype=np.uint8)
        
        # Expand radius slightly to capture the whole tire
        r_expanded = int(r * 1.1)
        cv2.circle(mask, (x, y), r_expanded, 255, -1)
        
        # Extract wheel
        wheel_np = np.zeros_like(body_np)
        wheel_np[mask == 255] = body_np[mask == 255]
        
        # Crop the wheel to its bounding box
        crop_y1 = max(0, y - r_expanded)
        crop_y2 = min(h, y + r_expanded)
        crop_x1 = max(0, x - r_expanded)
        crop_x2 = min(w, x + r_expanded)
        
        wheel_cropped = wheel_np[crop_y1:crop_y2, crop_x1:crop_x2]
        wheel_img = Image.fromarray(wheel_cropped)
        
        wheel_images.append({
            'img': wheel_img,
            'x': crop_x1,
            'y': crop_y1
        })
        
        # Erase wheel from body by setting alpha to 0
        body_np[mask == 255, 3] = 0
        
    body_img = Image.fromarray(body_np)
    
    # 4. Animation Assembly
    print("[*] Assembling frames...")
    frames = []
    num_frames = 30
    fps = 15
    bounce_amp = max(2, int(h * 0.015)) # 1.5% height bounce
    
    for i in range(num_frames):
        progress = i / num_frames
        
        # Body bounce (sine wave, 2 full cycles per animation loop)
        y_offset = int(np.sin(progress * np.pi * 4) * bounce_amp)
        
        # Create blank canvas
        canvas = Image.new("RGBA", (w, h + bounce_amp*2), (0,0,0,0))
        
        # Paste body (bouncing)
        canvas.paste(body_img, (0, bounce_amp + y_offset), body_img)
        
        # Paste wheels (rotating, but fixed to the ground)
        angle = -360 * progress # Negative for forward motion
        
        for w_data in wheel_images:
            rotated_wheel = w_data['img'].rotate(angle, resample=Image.BICUBIC, expand=False)
            # Paste wheel at original position, keeping it grounded
            canvas.paste(rotated_wheel, (w_data['x'], w_data['y'] + bounce_amp), rotated_wheel)
            
        # Put a white background to avoid GIF transparency artifacting
        bg = Image.new("RGBA", canvas.size, (255,255,255,255))
        bg.paste(canvas, (0,0), canvas)
        
        frames.append(np.array(bg))
        
    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    imageio.mimsave(output_path, frames, fps=fps, loop=0)
    print(f"[+] Successfully saved Wheeler Animation to {output_path}")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python wheeler_animator.py <input> <output>")
    else:
        create_wheeler_animation(sys.argv[1], sys.argv[2])
