"""
Visualizer script for Meta Amateur Drawings Dataset (ADD).
Downloads dataset annotations and creates keypoint + bounding box overlays
on sample drawings for visual inspection.
"""
import os
import json
import urllib.request
import cv2
import numpy as np
from pathlib import Path

DATASET_ROOT = Path(__file__).parent.parent / "datasets" / "sketch_humanoids"
ANNOTATIONS_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings_annotations.json"

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

SKELETON_PAIRS = [
    (0, 1), (0, 2), (1, 3), (2, 4),               # Head
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),      # Arms
    (5, 11), (6, 12), (11, 12),                   # Torso
    (11, 13), (13, 15), (12, 14), (14, 16)        # Legs
]

def ensure_annotations():
    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    json_path = DATASET_ROOT / "annotations.json"
    if not json_path.exists():
        print(f"[*] Downloading Meta ADD Annotations (~275 MB) from:\n    {ANNOTATIONS_URL}")
        urllib.request.urlretrieve(ANNOTATIONS_URL, json_path)
        print("[SUCCESS] Downloaded annotations.json")

def inspect_dataset_summary():
    ensure_annotations()
    json_path = DATASET_ROOT / "annotations.json"
    
    with open(json_path, 'r') as f:
        data = json.load(f)

    images = data.get('images', [])
    annotations = data.get('annotations', [])
    categories = data.get('categories', [])

    print("=" * 60)
    print("  META AMATEUR DRAWINGS DATASET (ADD) SUMMARY")
    print("=" * 60)
    print(f"Total Images:      {len(images):,}")
    print(f"Total Annotations: {len(annotations):,}")
    print(f"Categories:        {[c['name'] for c in categories]}")
    
    if len(annotations) > 0:
        sample_ann = annotations[0]
        print(f"\nSample Annotation Structure:")
        print(f"  Image ID:   {sample_ann.get('image_id')}")
        print(f"  BBox:       {sample_ann.get('bbox')}")
        print(f"  Keypoints:  {len(sample_ann.get('keypoints', []))} values (17 joints x (x,y,v))")

if __name__ == '__main__':
    inspect_dataset_summary()
