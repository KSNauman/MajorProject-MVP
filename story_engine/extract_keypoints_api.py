import sys
import json
import cv2
import yaml
import os
import subprocess
import tempfile
import shutil

def extract(img_path):
    # Absolute path to AnimatedDrawings
    repo_root = r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings'
    
    # We create a temporary directory for the output of image_to_annotations.py
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Run the actual YOLO estimation script
        script_path = os.path.join(repo_root, 'examples', 'image_to_annotations.py')
        result = subprocess.run(
            [sys.executable, script_path, img_path, temp_dir],
            cwd=repo_root,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(json.dumps({"error": f"Extraction failed: {result.stderr}"}))
            return
            
        # Parse char_cfg.yaml
        cfg_path = os.path.join(temp_dir, 'char_cfg.yaml')
        if not os.path.exists(cfg_path):
            print(json.dumps({"error": "Failed to generate char_cfg.yaml"}))
            return
            
        with open(cfg_path, 'r') as f:
            cfg = yaml.safe_load(f)
            
        skeleton_data = cfg.get('skeleton', [])
        
        # Format keypoints for frontend
        # skeleton_data is like: [{'loc': [x, y], 'name': 'hip', 'parent': 'root'}, ...]
        keypoints = []
        
        for joint in skeleton_data:
            keypoints.append({
                "name": joint["name"],
                "x": joint["loc"][0],
                "y": joint["loc"][1],
                "parent": joint.get("parent")
            })
            
        # Heuristic for non-humanoid: if it couldn't find arms or legs properly
        # YOLO usually clumps them together if it fails. We'll just set it to False for now
        # because AnimatedDrawings always enforces a full skeleton.
        is_non_humanoid = False 
        
        print(json.dumps({
            "isNonHumanoid": is_non_humanoid,
            "keypoints": keypoints
        }))
        
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    extract(sys.argv[1])
