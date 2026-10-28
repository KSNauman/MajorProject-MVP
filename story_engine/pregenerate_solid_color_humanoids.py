import os
import sys
import cv2
import numpy as np
import yaml
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR / "Actual repo (EDUVISION)" / "AnimatedDrawings"
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(BASE_DIR / "story_engine"))

from batch_animate import generate_animation, STORY_MOTIONS

COLORS = [
    ('red', (68, 68, 239)),       # #ef4444 in BGR
    ('blue', (246, 130, 59)),     # #3b82f6 in BGR
    ('green', (94, 197, 34)),     # #22c55e in BGR
    ('yellow', (8, 179, 234)),    # #eab308 in BGR
    ('purple', (247, 85, 168)),   # #a855f7 in BGR
    ('orange', (22, 115, 249))    # #f97316 in BGR
]

def generate_solid_humanoid(color_name: str, bgr: tuple):
    h, w = 500, 360
    img = np.zeros((h, w, 4), dtype=np.uint8)
    color_rgba = (bgr[0], bgr[1], bgr[2], 255)
    border_rgba = (30, 41, 59, 255)

    # Head
    cv2.ellipse(img, (180, 90), (45, 52), 0, 0, 360, color_rgba, -1)
    cv2.ellipse(img, (180, 90), (45, 52), 0, 0, 360, border_rgba, 4)
    # Smiling eyes and mouth
    cv2.circle(img, (165, 85), 5, border_rgba, -1)
    cv2.circle(img, (195, 85), 5, border_rgba, -1)
    cv2.ellipse(img, (180, 105), (14, 8), 0, 0, 180, border_rgba, 3)

    # Neck
    cv2.rectangle(img, (170, 140), (190, 160), color_rgba, -1)

    # Torso
    pts_torso = np.array([[120, 160], [240, 160], [250, 290], [110, 290]], np.int32)
    cv2.fillPoly(img, [pts_torso], color_rgba)
    cv2.polylines(img, [pts_torso], True, border_rgba, 4)

    # Star badge
    cv2.circle(img, (180, 225), 10, (138, 240, 254, 255), -1)

    # Arms
    cv2.line(img, (120, 165), (70, 240), color_rgba, 28)
    cv2.circle(img, (60, 245), 18, color_rgba, -1)
    cv2.line(img, (240, 165), (290, 240), color_rgba, 28)
    cv2.circle(img, (300, 245), 18, color_rgba, -1)

    # Legs
    cv2.line(img, (145, 290), (140, 430), color_rgba, 28)
    cv2.ellipse(img, (135, 445), (25, 14), 0, 0, 360, color_rgba, -1)
    cv2.line(img, (215, 290), (220, 430), color_rgba, 28)
    cv2.ellipse(img, (225, 445), (25, 14), 0, 0, 360, color_rgba, -1)

    out_dir = BASE_DIR / "platform" / "activity-center" / "public" / "uploads" / "solid_humanoids" / color_name
    out_dir.mkdir(parents=True, exist_ok=True)

    cv2.imwrite(str(out_dir / "texture.png"), img)
    mask = (img[:, :, 3] > 20).astype(np.uint8) * 255
    cv2.imwrite(str(out_dir / "mask.png"), mask)

    cx = 180
    char_cfg = {
        'width': w,
        'height': h,
        'skeleton': [
            {'name': 'root', 'loc': [cx, 290], 'parent': None},
            {'name': 'hip', 'loc': [cx, 290], 'parent': 'root'},
            {'name': 'torso', 'loc': [cx, 220], 'parent': 'hip'},
            {'name': 'neck', 'loc': [cx, 145], 'parent': 'torso'},
            {'name': 'right_shoulder', 'loc': [120, 165], 'parent': 'torso'},
            {'name': 'right_elbow', 'loc': [95, 205], 'parent': 'right_shoulder'},
            {'name': 'right_hand', 'loc': [60, 245], 'parent': 'right_elbow'},
            {'name': 'left_shoulder', 'loc': [240, 165], 'parent': 'torso'},
            {'name': 'left_elbow', 'loc': [265, 205], 'parent': 'left_shoulder'},
            {'name': 'left_hand', 'loc': [300, 245], 'parent': 'left_elbow'},
            {'name': 'right_hip', 'loc': [145, 290], 'parent': 'root'},
            {'name': 'right_knee', 'loc': [140, 360], 'parent': 'right_hip'},
            {'name': 'right_foot', 'loc': [135, 445], 'parent': 'right_knee'},
            {'name': 'left_hip', 'loc': [215, 290], 'parent': 'root'},
            {'name': 'left_knee', 'loc': [220, 360], 'parent': 'left_hip'},
            {'name': 'left_foot', 'loc': [225, 445], 'parent': 'left_knee'},
        ]
    }
    with open(str(out_dir / "char_cfg.yaml"), 'w') as f:
        yaml.dump(char_cfg, f)

    print(f"Generating animations for {color_name}...")
    generate_animation(str(out_dir), 'jump', STORY_MOTIONS['jump'])
    generate_animation(str(out_dir), 'walk_in_circle', STORY_MOTIONS['walk_in_circle'])
    print(f"Done {color_name}!")

if __name__ == '__main__':
    for name, bgr in COLORS:
        generate_solid_humanoid(name, bgr)
    print("ALL 6 SOLID COLOR HUMANOID ANIMATIONS CACHED SUCCESSFULLY!")
