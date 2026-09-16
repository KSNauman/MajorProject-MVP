"""
yolo_pose_detector.py
---------------------
Loads the trained best.pt YOLO pose model and runs inference on a sketch image.
Returns a normalized keypoint dictionary for all 17 COCO joints.
"""

import os
import cv2
import numpy as np
from pathlib import Path
from ultralytics import YOLO

# ── Model path ────────────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_PATH  = _REPO_ROOT / "yolo_test" / "best.pt"

TARGET_SIZE = 640

KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# Singleton model — loaded once, reused across calls
_model = None


def _load_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"[YOLOPoseDetector] best.pt not found at: {MODEL_PATH}\n"
                f"Place your trained model at: {MODEL_PATH}"
            )
        print(f"[YOLOPoseDetector] Loading model from: {MODEL_PATH}")
        _model = YOLO(str(MODEL_PATH))
        print("[YOLOPoseDetector] Model loaded successfully.")
    return _model


def _letterbox(img: np.ndarray, size: int = TARGET_SIZE) -> tuple:
    """
    Resize image preserving aspect ratio onto a white square canvas.
    Returns (canvas, x_offset, y_offset, scale) so keypoints can be
    mapped back to original image coordinates.
    """
    h, w = img.shape[:2]
    scale  = size / max(h, w)
    new_w  = int(w * scale)
    new_h  = int(h * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas  = np.ones((size, size, 3), dtype=np.uint8) * 255
    x_off   = (size - new_w) // 2
    y_off   = (size - new_h) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized
    return canvas, x_off, y_off, scale


def detect_pose(image_path: str, conf_threshold: float = 0.05) -> dict:
    """
    Run YOLO pose estimation on a sketch image.

    Args:
        image_path:     Path to input sketch image (PNG/JPG).
        conf_threshold: Minimum keypoint confidence to include (default 0.05).

    Returns:
        {
          "detected":   True/False,
          "keypoints":  {
              "nose":           {"x": float, "y": float, "conf": float},
              "left_shoulder":  {"x": float, "y": float, "conf": float},
              ... (all 17 joints, None if below threshold)
          },
          "annotated_image": np.ndarray  (BGR, 640x640 with skeleton drawn)
        }
    """
    model = _load_model()

    img = cv2.imread(str(image_path))
    if img is None:
        raise FileNotFoundError(f"[YOLOPoseDetector] Cannot read image: {image_path}")

    orig_h, orig_w = img.shape[:2]
    canvas, x_off, y_off, scale = _letterbox(img)

    results = model(canvas, verbose=False)
    result  = results[0]

    # Draw annotated skeleton
    try:
        annotated = result.plot(kpt_radius=5, line_width=2)
    except TypeError:
        annotated = result.plot()

    # Parse keypoints
    keypoints_out = {name: None for name in KEYPOINT_NAMES}
    detected      = False

    if result.keypoints is not None and len(result.keypoints.data) > 0:
        kpts = result.keypoints.data[0].cpu().numpy()  # shape [17, 3]

        for idx, kpt in enumerate(kpts):
            if idx >= len(KEYPOINT_NAMES):
                break
            x_canvas, y_canvas = float(kpt[0]), float(kpt[1])
            conf = float(kpt[2]) if len(kpt) > 2 else 0.0

            if conf >= conf_threshold and (x_canvas != 0 or y_canvas != 0):
                # Map from letterboxed canvas coords → original image coords
                x_orig = (x_canvas - x_off) / scale
                y_orig = (y_canvas - y_off) / scale
                # Normalize to [0, 1] relative to original image
                x_norm = max(0.0, min(1.0, x_orig / orig_w))
                y_norm = max(0.0, min(1.0, y_orig / orig_h))
                keypoints_out[KEYPOINT_NAMES[idx]] = {
                    "x": x_norm, "y": y_norm, "conf": conf
                }
                detected = True

    if detected:
        detected_count = sum(1 for v in keypoints_out.values() if v is not None)
        print(f"[YOLOPoseDetector] Detected {detected_count}/17 joints.")
    else:
        print("[YOLOPoseDetector] No skeleton detected in this image.")

    return {
        "detected":        detected,
        "keypoints":       keypoints_out,
        "annotated_image": annotated
    }


def save_annotated(result: dict, output_path: str) -> str:
    """Save the annotated skeleton image to disk. Returns the saved path."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    cv2.imwrite(output_path, result["annotated_image"])
    print(f"[YOLOPoseDetector] Annotated image saved to: {output_path}")
    return output_path


# ── CLI quick-test ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 2:
        print("Usage: python yolo_pose_detector.py <image_path>")
        sys.exit(1)

    img_path = " ".join(sys.argv[1:])
    result   = detect_pose(img_path)

    print("\n--- POSE DETECTION RESULT ---")
    printable = {k: v for k, v in result["keypoints"].items() if v is not None}
    print(json.dumps(printable, indent=2))

    out = Path(img_path).stem + "_skeleton.png"
    save_annotated(result, out)
    print(f"Saved annotated image: {out}")
