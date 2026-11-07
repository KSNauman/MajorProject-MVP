"""
ai_server.py
============
Keeps the pose and segmentation models and the animation engine loaded so each
request skips the start-up cost. Listens on this machine only, and handles one
request at a time on the main thread, as the shared models and OpenGL need.
"""

import os
import shutil
import sys
import tempfile
from flask import Flask, request, jsonify

os.environ['USE_GPU'] = 'true'

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.join(base_dir, 'Actual repo (EDUVISION)', 'AnimatedDrawings')
sys.path.insert(0, repo_root)
os.chdir(repo_root)

from examples.image_to_annotations import image_to_annotations
from batch_animate import STORY_MOTIONS, batch_generate, generate_animation, write_manifest

PORT = int(os.environ.get('AI_SERVER_PORT', '5001'))
SAMPLE_DRAWING = os.path.join(base_dir, 'characters', 'rahim', 'source_image.png')

app = Flask(__name__)

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/annotate', methods=['POST'])
def annotate():
    data = request.json
    img_path, out_dir, kps_path = data.get('img_path'), data.get('out_dir'), data.get('kps_path')
    if not img_path or not out_dir or not os.path.exists(img_path):
        return jsonify({"error": "Invalid image path"}), 400
    try:
        image_to_annotations(img_path, out_dir, kps_path)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Engine failed: {e}"}), 500

@app.route('/animate', methods=['POST'])
def animate():
    data = request.json
    char_dir = data.get('char_dir')
    if not char_dir or not os.path.isdir(char_dir):
        return jsonify({"error": "Invalid character folder"}), 400
    results = batch_generate(char_dir, data.get('motions'))
    write_manifest(char_dir, data.get('slot', 'unknown'), results)
    return jsonify({"results": results})

def load_models():
    """Process one drawing at start-up so the first real request is already fast."""
    warmup_dir = tempfile.mkdtemp()
    try:
        image_to_annotations(SAMPLE_DRAWING, warmup_dir)
        result = generate_animation(warmup_dir, 'idel', STORY_MOTIONS['idel'])
        if result['status'] == 'error':
            print(f"Animation engine warm-up failed: {result['error']}")
    finally:
        shutil.rmtree(warmup_dir, ignore_errors=True)

if __name__ == '__main__':
    print("Loading models...")
    load_models()
    print(f"EduVision AI Server ready on port {PORT}")
    app.run(host='127.0.0.1', port=PORT, debug=False, threaded=False)
