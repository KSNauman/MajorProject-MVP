# Copyright (c) Meta Platforms, Inc. and affiliates.
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.
#
# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 — Sketch → Skeleton Annotations
# ─────────────────────────────────────────────────────────────────────────────
# Powered by custom YOLOv8-Pose (best.pt) trained on children's drawings.
# Replaces TorchServe + drawn_humanoid_detector.mar + drawn_humanoid_pose_estimator.mar
#
# Pipeline:
#   1. Load best.pt  (YOLOv8-Pose, trained on 'humanoid' class)
#   2. Detect bounding box of character in the sketch
#   3. Crop character region
#   4. Segment mask  (hybrid: rembg AI silhouette + OpenCV pen lines)
#   5. Re-run pose on crop → 17 COCO keypoints
#   6. Map 17 COCO joints → 16 AnimatedDrawings joints
#   7. Write: texture.png, mask.png, char_cfg.yaml, joint_overlay.png
#
# Outputs feed Phase 2 unchanged:
#   annotations_to_animation.py → Delaunay mesh → ARAP physics → GIF
# ─────────────────────────────────────────────────────────────────────────────

import sys
import cv2
import numpy as np
from skimage import measure
from scipy import ndimage
from pathlib import Path
import yaml
import logging
import rembg
from ultralytics import YOLO


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADER
# ─────────────────────────────────────────────────────────────────────────────

def _load_model() -> YOLO:
    """
    Locate and load best.pt (custom YOLOv8-Pose for children's sketches).
    Searches several relative paths so it works regardless of CWD.
    """
    script_dir = Path(__file__).resolve().parent
    candidates = [
        script_dir.parent / "best.pt",        # AnimatedDrawings/best.pt  ← primary
        script_dir / "best.pt",               # examples/best.pt
        script_dir.parent.parent / "best.pt", # repo-root/../best.pt
    ]
    for p in candidates:
        if p.exists():
            logging.info(f"[YOLO] Loading custom pose model: {p}")
            return YOLO(str(p))
    raise FileNotFoundError(
        "best.pt not found. Expected at: " + str(candidates[0])
    )


# ─────────────────────────────────────────────────────────────────────────────
# KEYPOINT MAPPING  —  17 COCO  →  16 AnimatedDrawings joints
# ─────────────────────────────────────────────────────────────────────────────
#
#  COCO index → AD joint name
#  ──────────────────────────────────────────────────────
#   0  nose            → neck
#   5  left_shoulder   → left_shoulder
#   6  right_shoulder  → right_shoulder
#   7  left_elbow      → left_elbow
#   8  right_elbow     → right_elbow
#   9  left_wrist      → left_hand
#  10  right_wrist     → right_hand
#  11  left_hip        → left_hip
#  12  right_hip       → right_hip
#  13  left_knee       → left_knee
#  14  right_knee      → right_knee
#  15  left_ankle      → left_foot
#  16  right_ankle     → right_foot
#  avg(11,12)          → root  (pelvis midpoint)
#  avg(11,12)          → hip   (same point — AD convention)
#  avg(5,6)            → torso (shoulder midpoint)
# ─────────────────────────────────────────────────────────────────────────────

def _build_skeleton(kpts: np.ndarray) -> list:
    """
    Convert (17, 3) COCO keypoints [x, y, confidence] in crop-pixel coords
    into the 16-joint AnimatedDrawings skeleton list.

    Args:
        kpts: numpy array shape (17, 3)

    Returns:
        List of dicts {'loc': [x, y], 'name': str, 'parent': str | None}
    """

    def pt(idx: int):
        return [round(float(kpts[idx, 0])), round(float(kpts[idx, 1]))]

    def mid(a: int, b: int):
        return [
            round((float(kpts[a, 0]) + float(kpts[b, 0])) / 2),
            round((float(kpts[a, 1]) + float(kpts[b, 1])) / 2),
        ]

    pelvis  = mid(11, 12)   # root / hip
    mid_sho = mid(5, 6)     # torso

    return [
        {"loc": pelvis,   "name": "root",           "parent": None},
        {"loc": pelvis,   "name": "hip",            "parent": "root"},
        {"loc": mid_sho,  "name": "torso",          "parent": "hip"},
        {"loc": pt(0),    "name": "neck",           "parent": "torso"},
        # Right arm chain
        {"loc": pt(6),    "name": "right_shoulder", "parent": "torso"},
        {"loc": pt(8),    "name": "right_elbow",    "parent": "right_shoulder"},
        {"loc": pt(10),   "name": "right_hand",     "parent": "right_elbow"},
        # Left arm chain
        {"loc": pt(5),    "name": "left_shoulder",  "parent": "torso"},
        {"loc": pt(7),    "name": "left_elbow",     "parent": "left_shoulder"},
        {"loc": pt(9),    "name": "left_hand",      "parent": "left_elbow"},
        # Right leg chain
        {"loc": pt(12),   "name": "right_hip",      "parent": "root"},
        {"loc": pt(14),   "name": "right_knee",     "parent": "right_hip"},
        {"loc": pt(16),   "name": "right_foot",     "parent": "right_knee"},
        # Left leg chain
        {"loc": pt(11),   "name": "left_hip",       "parent": "root"},
        {"loc": pt(13),   "name": "left_knee",      "parent": "left_hip"},
        {"loc": pt(15),   "name": "left_foot",      "parent": "left_knee"},
    ]


# ─────────────────────────────────────────────────────────────────────────────
# SEGMENTATION  —  hybrid rembg + OpenCV (unchanged, proven approach)
# ─────────────────────────────────────────────────────────────────────────────

def segment(img: np.ndarray):
    """
    Hybrid segmentation mask for a cropped character image:
      1. rembg (U2-Net) AI → semantic silhouette
      2. OpenCV adaptive threshold → crisp pen-line mask
      3. Bitwise AND → noise-free intersection
      4. Flood-fill border removal + largest contour retained
    """
    # 1. AI background removal
    ai_mask = rembg.remove(img, only_mask=True)

    # 2. OpenCV adaptive threshold on darkest channel (pen lines)
    gray   = np.min(img, axis=2)
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
        115, 8
    )
    thresh = cv2.bitwise_not(thresh)

    # 3. Morphological clean-up
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE,  kernel, iterations=2)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_DILATE, kernel, iterations=2)

    # 4. Intersect AI silhouette with pen-line mask
    combined = cv2.bitwise_and(thresh, ai_mask)

    # 5. Flood-fill from all borders to kill stray disconnected blobs
    mask_ff = np.zeros([combined.shape[0] + 2, combined.shape[1] + 2], np.uint8)
    mask_ff[1:-1, 1:-1] = combined.copy()
    im_floodfill = np.full(combined.shape, 255, np.uint8)
    h, w = combined.shape[:2]
    for x in range(0, w - 1, 10):
        cv2.floodFill(im_floodfill, mask_ff, (x,     0), 0)
        cv2.floodFill(im_floodfill, mask_ff, (x, h - 1), 0)
    for y in range(0, h - 1, 10):
        cv2.floodFill(im_floodfill, mask_ff, (0,     y), 0)
        cv2.floodFill(im_floodfill, mask_ff, (w - 1, y), 0)
    im_floodfill[0, :]  = 0
    im_floodfill[-1, :] = 0
    im_floodfill[:, 0]  = 0
    im_floodfill[:, -1] = 0

    # 6. Keep only the largest contour
    mask2    = cv2.bitwise_not(im_floodfill)
    mask     = None
    biggest  = 0
    contours = measure.find_contours(mask2, 0.0)
    for c in contours:
        x    = np.zeros(mask2.T.shape, np.uint8)
        cv2.fillPoly(x, [np.int32(c)], 1)
        size = len(np.where(x == 1)[0])
        if size > biggest:
            mask    = x
            biggest = size

    if mask is None:
        logging.warning("Contour logic failed — falling back to pure rembg mask.")
        mask = (ai_mask > 127).astype(np.uint8)
    else:
        mask = ndimage.binary_fill_holes(mask).astype(np.uint8)

    return (mask * 255).T


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE FUNCTION
# ─────────────────────────────────────────────────────────────────────────────

import json

def image_to_annotations(img_fn: str, out_dir: str, kpts_file: str = None) -> None:
    """
    Full Phase 1 pipeline: sketch image → annotation files for the ARAP engine.

    Args:
        img_fn:  Path to the input sketch PNG/JPG
        out_dir: Directory where outputs are written
    """
    outdir = Path(out_dir)
    outdir.mkdir(exist_ok=True, parents=True)

    # ── Read & resize ─────────────────────────────────────────────────────────
    img = cv2.imread(img_fn)
    if img is None:
        raise FileNotFoundError(f"Cannot open image: {img_fn}")
    if len(img.shape) != 3:
        msg = f"Image must have 3 channels. Got shape: {img.shape}"
        logging.critical(msg)
        assert False, msg

    cv2.imwrite(str(outdir / "image.png"), img)

    if np.max(img.shape) > 1000:
        scale = 1000 / np.max(img.shape)
        img   = cv2.resize(img, (
            round(scale * img.shape[1]),
            round(scale * img.shape[0])
        ))
        logging.info(f"Resized to {img.shape[1]}×{img.shape[0]} for inference.")

    # ── Phase 1-A: Detection ──────────────────────────────────────────────────
    model   = _load_model()
    results = model(img, verbose=False)
    result  = results[0]

    if result.boxes is None or len(result.boxes) == 0:
        logging.warning("No characters detected — using full image as fallback bounding box.")
        l, t, r, b = 0, 0, img.shape[1], img.shape[0]
    else:
        best_idx = int(result.boxes.conf.argmax())
        box      = result.boxes.xyxy[best_idx].cpu().numpy()
        l = max(0,             round(box[0]))
        t = max(0,             round(box[1]))
        r = min(img.shape[1],  round(box[2]))
        b = min(img.shape[0],  round(box[3]))
        conf = float(result.boxes.conf[best_idx])
        logging.info(
            f"Detected {len(result.boxes)} humanoid(s). "
            f"Best: conf={conf:.3f}, bbox=[{l},{t},{r},{b}]"
        )

    with open(str(outdir / "bounding_box.yaml"), "w") as f:
        yaml.dump({"left": l, "top": t, "right": r, "bottom": b}, f)

    # Crop
    cropped = img[t:b, l:r]
    if cropped.size == 0:
        raise ValueError(f"Empty crop with bbox [{l},{t},{r},{b}]")

    # ── Phase 1-B: Segmentation ───────────────────────────────────────────────
    mask = segment(cropped)

    # ── Phase 1-C: Keypoint Extraction on cropped image ──────────────────────
    crop_results = model(cropped, verbose=False)
    crop_result  = crop_results[0]

    if (crop_result.keypoints is None
            or len(crop_result.keypoints) == 0
            or crop_result.keypoints.data is None
            or len(crop_result.keypoints.data) == 0):
        # Fallback: translate full-image keypoints into crop-space coordinates
        logging.warning("No keypoints on crop — translating full-image keypoints to crop space.")
        if result.keypoints is None or len(result.keypoints.data) == 0:
            msg = "YOLOv8 produced no keypoints. Cannot build skeleton."
            logging.critical(msg)
            assert False, msg
        kpts = result.keypoints.data[0].cpu().numpy().copy()
        kpts[:, 0] -= l   # shift x into crop space
        kpts[:, 1] -= t   # shift y into crop space
    else:
        best_crop = (
            int(crop_result.boxes.conf.argmax())
            if crop_result.boxes is not None and len(crop_result.boxes) > 1
            else 0
        )
        kpts = crop_result.keypoints.data[best_crop].cpu().numpy()

    # Clamp to crop bounds
    kpts[:, 0] = np.clip(kpts[:, 0], 0, cropped.shape[1] - 1)
    kpts[:, 1] = np.clip(kpts[:, 1], 0, cropped.shape[0] - 1)

    logging.info(f"Keypoints extracted: {kpts.shape[0]} joints")

    # ── Build AnimatedDrawings skeleton ───────────────────────────────────────
    skeleton = _build_skeleton(kpts)

    # ── Save all Phase-2 inputs ───────────────────────────────────────────────
    char_cfg = {
        "skeleton": skeleton,
        "height":   cropped.shape[0],
        "width":    cropped.shape[1],
    }

    # texture.png — RGBA crop
    cropped_rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(str(outdir / "texture.png"), cropped_rgba)

    # mask.png
    cv2.imwrite(str(outdir / "mask.png"), mask)

    # char_cfg.yaml  ← consumed directly by annotations_to_animation.py
    with open(str(outdir / "char_cfg.yaml"), "w") as f:
        yaml.dump(char_cfg, f)

    # joint_overlay.png — visual debug aid
    joint_overlay = cropped_rgba.copy()
    for joint in skeleton:
        x, y = joint["loc"]
        cv2.circle(joint_overlay, (int(x), int(y)), 5, (0, 0, 0), 5)
        cv2.putText(
            joint_overlay, joint["name"],
            (int(x), int(y + 15)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, 2,
        )
    cv2.imwrite(str(outdir / "joint_overlay.png"), joint_overlay)

    logging.info(
        f"[Phase 1 ✓] Done — outputs in: {outdir}\n"
        "  texture.png | mask.png | char_cfg.yaml | joint_overlay.png"
    )


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry-point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log_dir = Path("./logs")
    log_dir.mkdir(exist_ok=True, parents=True)
    logging.basicConfig(
        filename=str(log_dir / "log.txt"),
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    # Mirror logs to stdout so the Node.js server can read progress
    logging.getLogger().addHandler(logging.StreamHandler(sys.stdout))

    if len(sys.argv) < 3:
        print("Usage: python image_to_annotations.py <input_image> <output_dir> [--keypoints json_file]")
        sys.exit(1)

    kpts = None
    if len(sys.argv) > 4 and sys.argv[3] == "--keypoints":
        kpts = sys.argv[4]

    image_to_annotations(sys.argv[1], sys.argv[2], kpts)
