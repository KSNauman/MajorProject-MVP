import sys
import json
import yaml
import os
import subprocess
import tempfile
import shutil
import time

def extract(img_path):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_root = os.path.join(base_dir, 'Actual repo (EDUVISION)', 'AnimatedDrawings')
    public_uploads = os.path.join(base_dir, 'eduvision_ui', 'public', 'uploads')
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
            
            import cv2
            img_raw = cv2.imread(img_path)
            h, w = (512, 512) if img_raw is None else img_raw.shape[:2]
            cx = w // 2
            
            # Create default skeleton proportionally scaled to image size
            default_kps = [
                {"name": "root", "x": cx, "y": int(h * 0.50), "parent": None},
                {"name": "hip", "x": cx, "y": int(h * 0.50), "parent": "root"},
                {"name": "torso", "x": cx, "y": int(h * 0.38), "parent": "hip"},
                {"name": "neck", "x": cx, "y": int(h * 0.25), "parent": "torso"},
                {"name": "right_shoulder", "x": int(cx - w * 0.12), "y": int(h * 0.28), "parent": "torso"},
                {"name": "right_elbow", "x": int(cx - w * 0.18), "y": int(h * 0.40), "parent": "right_shoulder"},
                {"name": "right_hand", "x": int(cx - w * 0.22), "y": int(h * 0.52), "parent": "right_elbow"},
                {"name": "left_shoulder", "x": int(cx + w * 0.12), "y": int(h * 0.28), "parent": "torso"},
                {"name": "left_elbow", "x": int(cx + w * 0.18), "y": int(h * 0.40), "parent": "left_shoulder"},
                {"name": "left_hand", "x": int(cx + w * 0.22), "y": int(h * 0.52), "parent": "left_elbow"},
                {"name": "right_hip", "x": int(cx - w * 0.08), "y": int(h * 0.50), "parent": "root"},
                {"name": "right_knee", "x": int(cx - w * 0.08), "y": int(h * 0.65), "parent": "right_hip"},
                {"name": "right_foot", "x": int(cx - w * 0.08), "y": int(h * 0.85), "parent": "right_knee"},
                {"name": "left_hip", "x": int(cx + w * 0.08), "y": int(h * 0.50), "parent": "root"},
                {"name": "left_knee", "x": int(cx + w * 0.08), "y": int(h * 0.65), "parent": "left_hip"},
                {"name": "left_foot", "x": int(cx + w * 0.08), "y": int(h * 0.85), "parent": "left_knee"}
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
        try:
            res = extract(sys.argv[1])
            print(json.dumps(res))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    else:
        print(json.dumps({"error": "No image path provided."}))
