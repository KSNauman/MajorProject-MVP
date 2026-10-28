import os
import sys
import json
import time
import shutil
import cv2
import numpy as np
import yaml
from pathlib import Path

# Ensure paths
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR / "Actual repo (EDUVISION)" / "AnimatedDrawings"
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(BASE_DIR / "story_engine"))

from batch_animate import generate_animation, STORY_MOTIONS

def process_drawing_and_animate(image_path: str, output_dir: str, motion: str = 'jump'):
    """
    Takes an input image (transparent PNG or photo), extracts/prepares texture,
    mask, and char_cfg.yaml, and runs AnimatedDrawings render engine.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    anim_dir = output_dir / "animations"
    anim_dir.mkdir(parents=True, exist_ok=True)

    gif_target = anim_dir / f"{motion}.gif"
    if gif_target.exists() and gif_target.stat().st_size > 0:
        return {"status": "ok", "path": str(gif_target)}

    img = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not load image from {image_path}")

    h, w = img.shape[:2]

    # Standardize image size for optimal animation engine performance (around 400-500px)
    max_dim = max(h, w)
    if max_dim > 600 or max_dim < 300:
        scale = 480.0 / float(max_dim)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    # 1. Generate texture.png and mask.png
    if len(img.shape) == 3 and img.shape[2] == 4:
        # Transparent RGBA image
        alpha = img[:, :, 3]
        mask = (alpha > 15).astype(np.uint8) * 255
        texture = img.copy()
    else:
        # BGR / Grayscale Photo
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        
        # Check background brightness (drawings on paper / webcam portraits usually have lighter background)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Edge/luminance thresholding to separate subject
        # If border is bright, threshold out white background
        border_pixels = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
        median_border = np.median(border_pixels)
        
        if median_border > 180:
            # Drawing on white/light paper
            _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
            # Dilate slightly to keep stroke connectivity
            kernel = np.ones((3, 3), np.uint8)
            mask = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        else:
            # Dark background or camera photo -> create an oval humanoid silhouette mask
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.ellipse(mask, (w // 2, h // 2), (int(w * 0.44), int(h * 0.46)), 0, 0, 360, 255, -1)

        # Ensure mask has enough subject pixels; if too small, use full frame vignette
        if np.count_nonzero(mask) < (h * w * 0.05):
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.ellipse(mask, (w // 2, h // 2), (int(w * 0.44), int(h * 0.46)), 0, 0, 360, 255, -1)

        # Convert to RGBA texture
        texture = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        texture[:, :, 3] = mask

    texture_path = output_dir / "texture.png"
    mask_path = output_dir / "mask.png"
    cv2.imwrite(str(texture_path), texture)
    cv2.imwrite(str(mask_path), mask)

    # 2. Build proportional humanoid skeleton matching AnimatedDrawings topology
    cx = w // 2
    char_cfg = {
        'width': w,
        'height': h,
        'skeleton': [
            {'name': 'root', 'loc': [cx, int(h * 0.56)], 'parent': None},
            {'name': 'hip', 'loc': [cx, int(h * 0.56)], 'parent': 'root'},
            {'name': 'torso', 'loc': [cx, int(h * 0.38)], 'parent': 'hip'},
            {'name': 'neck', 'loc': [cx, int(h * 0.26)], 'parent': 'torso'},
            {'name': 'right_shoulder', 'loc': [int(cx - w * 0.16), int(h * 0.32)], 'parent': 'torso'},
            {'name': 'right_elbow', 'loc': [int(cx - w * 0.28), int(h * 0.42)], 'parent': 'right_shoulder'},
            {'name': 'right_hand', 'loc': [int(cx - w * 0.36), int(h * 0.52)], 'parent': 'right_elbow'},
            {'name': 'left_shoulder', 'loc': [int(cx + w * 0.16), int(h * 0.32)], 'parent': 'torso'},
            {'name': 'left_elbow', 'loc': [int(cx + w * 0.28), int(h * 0.42)], 'parent': 'left_shoulder'},
            {'name': 'left_hand', 'loc': [int(cx + w * 0.36), int(h * 0.52)], 'parent': 'left_elbow'},
            {'name': 'right_hip', 'loc': [int(cx - w * 0.10), int(h * 0.56)], 'parent': 'root'},
            {'name': 'right_knee', 'loc': [int(cx - w * 0.11), int(h * 0.72)], 'parent': 'right_hip'},
            {'name': 'right_foot', 'loc': [int(cx - w * 0.12), int(h * 0.88)], 'parent': 'right_knee'},
            {'name': 'left_hip', 'loc': [int(cx + w * 0.10), int(h * 0.56)], 'parent': 'root'},
            {'name': 'left_knee', 'loc': [int(cx + w * 0.11), int(h * 0.72)], 'parent': 'left_hip'},
            {'name': 'left_foot', 'loc': [int(cx + w * 0.12), int(h * 0.88)], 'parent': 'left_knee'},
        ]
    }

    char_cfg_path = output_dir / "char_cfg.yaml"
    with open(str(char_cfg_path), 'w') as f:
        yaml.dump(char_cfg, f)

    # 3. Look up BVH motion
    motion_key = motion.lower().strip()
    bvh_path = STORY_MOTIONS.get(motion_key, STORY_MOTIONS.get('jump'))

    # 4. Render animation
    res = generate_animation(str(output_dir), motion_key, bvh_path)
    return res

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "error": "Usage: animate_drawing_service.py <image_path> <output_dir> [motion]"}))
        sys.exit(1)

    img_path = sys.argv[1]
    out_dir = sys.argv[2]
    motion_name = sys.argv[3] if len(sys.argv) > 3 else "jump"

    try:
        result = process_drawing_and_animate(img_path, out_dir, motion_name)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))
        sys.exit(1)
