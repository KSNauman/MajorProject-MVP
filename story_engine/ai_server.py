import sys
import os
import time
import json
import uuid
import shutil
import tempfile
import yaml
from flask import Flask, request, jsonify
from flask_cors import CORS

repo_root = r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings'
sys.path.insert(0, repo_root)

from examples.image_to_annotations import image_to_annotations

app = Flask(__name__)
CORS(app)

public_uploads = r'c:\Major Project - MVP2\Major Project - MVP\eduvision_ui\public\uploads'
os.makedirs(public_uploads, exist_ok=True)

@app.route('/extract', methods=['POST'])
def extract():
    data = request.json
    img_path = data.get('img_path', '').strip('"')
    if not img_path or not os.path.exists(img_path):
        return jsonify({"error": "Invalid image path"}), 400

    temp_dir = tempfile.mkdtemp()
    try:
        try:
            image_to_annotations(img_path, temp_dir)
            success = True
        except Exception as e:
            print("Extraction failed:", e)
            success = False

        if not success:
            fallback_name = f"fallback_{uuid.uuid4().hex}.png"
            fallback_dest = os.path.join(public_uploads, fallback_name)
            shutil.copy2(img_path, fallback_dest)
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
            return jsonify({
                "isNonHumanoid": True,
                "textureUrl": f"/uploads/{fallback_name}",
                "keypoints": default_kps
            })

        cfg_path = os.path.join(temp_dir, 'char_cfg.yaml')
        texture_path = os.path.join(temp_dir, 'texture.png')
        
        unique_name = f"robust_texture_{int(time.time())}.png"
        dest_path = os.path.join(public_uploads, unique_name)
        shutil.copy2(texture_path, dest_path)
        
        with open(cfg_path, 'r') as f:
            cfg = yaml.safe_load(f)
            
        keypoints = [{"name": j["name"], "x": j["loc"][0], "y": j["loc"][1], "parent": j.get("parent")} for j in cfg.get('skeleton', [])]
            
        return jsonify({
            "textureUrl": f"/uploads/{unique_name}",
            "keypoints": keypoints
        })
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@app.route('/prepare', methods=['POST'])
def prepare():
    data = request.json
    img_path = data.get('img_path', '').strip('"')
    kps_arg = data.get('kps_arg', 'none').strip('"')
    
    upload_dir = os.path.dirname(img_path)
    char_id = str(int(time.time()))
    char_dir = os.path.join(upload_dir, f'char_data_{char_id}')
    os.makedirs(char_dir, exist_ok=True)
    
    try:
        if kps_arg != "none" and os.path.exists(kps_arg):
            image_to_annotations(img_path, char_dir, kps_arg)
        else:
            image_to_annotations(img_path, char_dir)
        return jsonify({"success": True, "charDir": char_dir})
    except Exception as e:
        return jsonify({"error": f"Engine failed: {str(e)}"}), 500

if __name__ == '__main__':
    os.environ['USE_GPU'] = 'true'
    print("Starting EduVision AI Server on port 5000...")
    app.run(port=5000, debug=False)
