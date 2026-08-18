import os
import sys
from pathlib import Path
import cv2
import numpy as np
from ultralytics import YOLO

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear", 
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow", 
    "left_wrist", "right_wrist", "left_hip", "right_hip", 
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

def analyze_and_plot_pose(model, img_path, output_dir):
    print(f"\n=======================================================")
    print(f"Running Pose Estimation on: {img_path}")
    print(f"=======================================================")
    
    img_path = Path(img_path)
    if not img_path.exists():
        print(f"[Error] Image not found at {img_path.resolve()}")
        return

    # Run inference
    results = model(str(img_path), verbose=False)
    result = results[0]

    # Render bounding boxes and skeleton keypoint overlay
    try:
        annotated_img = result.plot(kpt_radius=5, line_width=2)
    except TypeError:
        annotated_img = result.plot()
    
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{img_path.stem}_skeleton_plot.png"
    cv2.imwrite(str(output_file), annotated_img)
    print(f"[+] Saved annotated skeleton visual to: {output_file.resolve()}")

    # Print extracted keypoint coordinates
    if result.keypoints is not None and len(result.keypoints) > 0 and len(result.keypoints.data) > 0:
        kpts = result.keypoints.data[0].cpu().numpy()  # shape [17, 3] or [17, 2]
        print(f"\nDetected Skeleton Keypoints (x, y, confidence):")
        print(f"{'Joint Name':<18} | {'X Coord':<10} | {'Y Coord':<10} | {'Confidence':<10}")
        print("-" * 55)
        for idx, kpt in enumerate(kpts):
            name = KEYPOINT_NAMES[idx] if idx < len(KEYPOINT_NAMES) else f"joint_{idx}"
            x, y = kpt[0], kpt[1]
            conf = kpt[2] if len(kpt) > 2 else 0.0
            if conf > 0.05 and (x != 0 or y != 0):
                print(f"{name:<18} | {x:<10.2f} | {y:<10.2f} | {conf:<10.2f}")
            else:
                print(f"{name:<18} | {'Not Detected / Below Threshold':<32}")
    else:
        print("[!] No skeleton keypoints detected in this image.")

def main():
    base_dir = Path("C:/MajorProject-MVP/MajorProject-MVP/yolo_test")
    model_path = base_dir / "sketch_yolov8_pose.pt"
    
    if not model_path.exists():
        fallback_path = Path("C:/MajorProject-MVP/MajorProject-MVP/yolov8n-pose.pt")
        print(f"[Warning] Custom model not found at {model_path}. Falling back to base model at {fallback_path}")
        model_path = fallback_path

    print(f"[*] Loading YOLOv8 Pose model from: {model_path.resolve()}")
    model = YOLO(str(model_path))

    output_dir = base_dir / "inference_results2"

    # Allow custom image path from CLI, otherwise run on default test images
    if len(sys.argv) > 1:
        joined_path = Path(" ".join(sys.argv[1:]))
        if joined_path.exists() and not all(Path(p).exists() for p in sys.argv[1:]):
            test_images = [joined_path]
        else:
            test_images = [Path(p) for p in sys.argv[1:]]
    else:
        test_images = [
            base_dir / "human_test.png",
            base_dir / "human_test2.png",
            base_dir / "output_test_anno/image.png"
        ]

    for img in test_images:
        analyze_and_plot_pose(model, img, output_dir)

if __name__ == "__main__":
    main()
