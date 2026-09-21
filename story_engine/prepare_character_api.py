import sys
import os
import json
import time
import subprocess

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing image path"}))
        sys.exit(1)
        
    img_path = sys.argv[1].strip('"')
    kps_arg = sys.argv[3].strip('"') if len(sys.argv) > 3 else "none"
    
    upload_dir = os.path.dirname(img_path)
    char_id = str(int(time.time()))
    char_dir = os.path.join(upload_dir, f'char_data_{char_id}')
    os.makedirs(char_dir, exist_ok=True)
    
    repo_root = r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings'
    script_path = os.path.join(repo_root, 'examples', 'image_to_annotations.py')
    
    cmd = [sys.executable, script_path, img_path, char_dir]
    if kps_arg != "none" and os.path.exists(kps_arg):
        cmd.extend(['--keypoints', kps_arg])
        
    result = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(json.dumps({"error": f"Engine failed: {result.stderr}"}))
        sys.exit(1)
        
    batch_script = os.path.join(os.path.dirname(__file__), 'batch_animate.py')
    # Run in background (detached)
    subprocess.Popen(
        [sys.executable, batch_script, char_dir], 
        stdout=subprocess.DEVNULL, 
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW
    )

    print(json.dumps({
        "success": True, 
        "charDir": char_dir
    }))

if __name__ == '__main__':
    main()
