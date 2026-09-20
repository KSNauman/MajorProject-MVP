import sys
import json
import yaml
import os
import subprocess
import tempfile
import shutil
import time

def extract(img_path):
    repo_root = r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings'
    public_uploads = r'c:\Major Project - MVP2\Major Project - MVP\eduvision_ui\public\uploads'
    os.makedirs(public_uploads, exist_ok=True)
    
    # Strip quotes if present
    img_path = img_path.strip('"')

    temp_dir = tempfile.mkdtemp()
    
    try:
        script_path = os.path.join(repo_root, 'examples', 'image_to_annotations.py')
        result = subprocess.run(
            [sys.executable, script_path, img_path, temp_dir],
            cwd=repo_root,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            # If the engine failed, it likely found no keypoints (non-humanoid).
            # We fallback to sending the raw image back to the UI so the user can draw on it.
            import uuid
            fallback_name = f"fallback_{uuid.uuid4().hex}.png"
            fallback_dest = os.path.join(public_uploads, fallback_name)
            
            # Use original image as fallback
            shutil.copy2(img_path, fallback_dest)
            
            # Create default skeleton in the center (assuming ~512x512 image, center is 256, 256)
            default_kps = [
                {"name": "root", "x": 256, "y": 256, "parent": None},
                {"name": "hip", "x": 256, "y": 256, "parent": "root"},
                {"name": "torso", "x": 256, "y": 200, "parent": "hip"},
                {"name": "neck", "x": 256, "y": 150, "parent": "torso"},
                {"name": "right_shoulder", "x": 200, "y": 150, "parent": "torso"},
                {"name": "right_elbow", "x": 170, "y": 200, "parent": "right_shoulder"},
                {"name": "right_hand", "x": 150, "y": 250, "parent": "right_elbow"},
                {"name": "left_shoulder", "x": 312, "y": 150, "parent": "torso"},
                {"name": "left_elbow", "x": 342, "y": 200, "parent": "left_shoulder"},
                {"name": "left_hand", "x": 362, "y": 250, "parent": "left_elbow"},
                {"name": "right_hip", "x": 230, "y": 256, "parent": "root"},
                {"name": "right_knee", "x": 230, "y": 320, "parent": "right_hip"},
                {"name": "right_foot", "x": 230, "y": 380, "parent": "right_knee"},
                {"name": "left_hip", "x": 282, "y": 256, "parent": "root"},
                {"name": "left_knee", "x": 282, "y": 320, "parent": "left_hip"},
                {"name": "left_foot", "x": 282, "y": 380, "parent": "left_knee"}
            ]
            res = {
                "isNonHumanoid": True,
                "textureUrl": f"/uploads/{fallback_name}",
                "keypoints": default_kps
            }
            return res
            
        cfg_path = os.path.join(temp_dir, 'char_cfg.yaml')
        texture_path = os.path.join(temp_dir, 'texture.png')
        
        if not os.path.exists(cfg_path) or not os.path.exists(texture_path):
            print(json.dumps({"error": "Failed to generate char_cfg.yaml or texture.png"}))
            return
            
        # Move texture.png to public uploads so UI can access it
        unique_name = f"robust_texture_{int(time.time())}.png"
        dest_path = os.path.join(public_uploads, unique_name)
        shutil.copy2(texture_path, dest_path)
        
        with open(cfg_path, 'r') as f:
            cfg = yaml.safe_load(f)
            
        skeleton_data = cfg.get('skeleton', [])
        
        # Format keypoints for frontend. NO OFFSET MATH NEEDED!
        # These keypoints map 1:1 perfectly with texture.png!
        keypoints = []
        for joint in skeleton_data:
            keypoints.append({
                "name": joint["name"],
                "x": joint["loc"][0],
                "y": joint["loc"][1],
                "parent": joint.get("parent")
            })
            
        result_dict = {
            "textureUrl": f"/uploads/{unique_name}",
            "keypoints": keypoints
        }
        return result_dict
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        res = extract(sys.argv[1])
        print(json.dumps(res))
    else:
        print(json.dumps({"error": "No image path provided."}))
