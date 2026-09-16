"""
robust_animator.py
------------------
Humanoid animation stage using the trained YOLO best.pt pose model.
Replaces the old AnimatedDrawings dependency entirely.

Given an input sketch image:
  1. Runs best.pt pose estimation to detect 17 keypoints.
  2. Draws the full annotated skeleton overlay on the image.
  3. Saves output to core_engine/output/.
  4. Prints a clean keypoint summary table.
"""

import os
import sys
import json
import shutil
import cv2
import numpy as np
from pathlib import Path

# Add core_engine root to path so we can import pose module
_CORE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_CORE_ROOT))

from pose.yolo_pose_detector import detect_pose, save_annotated


OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "output"


def animate_humanoid(image_path: str, output_dir: str = None) -> dict:
    """
    Main entry point for the humanoid animation stage.

    Args:
        image_path: Path to the input sketch image.
        output_dir: Optional override for output directory.

    Returns:
        {
          "success":         bool,
          "output_image":    str (path to annotated skeleton PNG),
          "keypoints":       dict (17 joints with normalized x, y, conf),
          "detected_joints": int
        }
    """
    image_path = Path(image_path)
    out_dir    = Path(output_dir) if output_dir else OUTPUT_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n[HumanoidAnimator] Processing: {image_path.name}")
    print("[HumanoidAnimator] Running best.pt pose estimation...")

    try:
        result = detect_pose(str(image_path))
    except Exception as e:
        print(f"[HumanoidAnimator] Pose detection failed: {e}")
        return {"success": False, "output_image": None, "keypoints": {}, "detected_joints": 0}

    if not result["detected"]:
        print("[HumanoidAnimator] No human figure detected in this sketch.")
        return {"success": False, "output_image": None, "keypoints": {}, "detected_joints": 0}

    # Save annotated skeleton image
    out_path = str(out_dir / f"{image_path.stem}_skeleton.png")
    save_annotated(result, out_path)

    # Print keypoint table
    keypoints = result["keypoints"]
    detected_joints = sum(1 for v in keypoints.values() if v is not None)

    print(f"\n[HumanoidAnimator] Skeleton Keypoints Detected ({detected_joints}/17):")
    print(f"  {'Joint':<18} {'X (norm)':<12} {'Y (norm)':<12} {'Conf':<8}")
    print("  " + "-" * 52)
    for name, kpt in keypoints.items():
        if kpt:
            print(f"  {name:<18} {kpt['x']:<12.3f} {kpt['y']:<12.3f} {kpt['conf']:<8.2f}")
        else:
            print(f"  {name:<18} {'not detected':<32}")

    # Save keypoints as JSON alongside output image
    json_path = str(out_dir / f"{image_path.stem}_keypoints.json")
    with open(json_path, "w") as f:
        json.dump(keypoints, f, indent=2)
    print(f"\n[HumanoidAnimator] Keypoints saved: {json_path}")
    print(f"[HumanoidAnimator] Skeleton image saved: {out_path}")

    return {
        "success":         True,
        "output_image":    out_path,
        "keypoints":       keypoints,
        "detected_joints": detected_joints
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python robust_animator.py <image_path>")
        sys.exit(1)
    img = " ".join(sys.argv[1:])
    animate_humanoid(img)
