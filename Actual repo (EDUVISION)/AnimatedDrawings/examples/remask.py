import sys
import cv2
import numpy as np
from pathlib import Path
import rembg
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def _human_seg_mask(img_bgr: np.ndarray) -> np.ndarray:
    logging.info("Initializing rembg session (u2net_human_seg)...")
    session = rembg.new_session("u2net_human_seg")
    logging.info("Applying rembg mask...")
    mask = rembg.remove(img_bgr, session=session, only_mask=True)
    return mask

def _threshold_mask(img_bgr: np.ndarray) -> np.ndarray:
    logging.info("Applying OpenCV adaptive threshold mask...")
    gray = np.min(img_bgr, axis=2)
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
        115, 8
    )
    thresh = cv2.bitwise_not(thresh)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_DILATE, kernel, iterations=2)
    
    from scipy import ndimage
    mask = ndimage.binary_fill_holes(thresh).astype(np.uint8)
    return mask * 255

def remask(out_dir: str, method: str):
    outdir = Path(out_dir)
    texture_path = outdir / "texture.png"
    mask_path = outdir / "mask.png"
    
    if not texture_path.exists():
        logging.error(f"Cannot find texture.png in {outdir}")
        sys.exit(1)
        
    logging.info(f"Loading {texture_path}")
    texture_rgba = cv2.imread(str(texture_path), cv2.IMREAD_UNCHANGED)
    
    if texture_rgba.shape[2] == 4:
        img_bgr = texture_rgba[:, :, :3]
    else:
        img_bgr = texture_rgba
        
    if method == "human_seg":
        mask = _human_seg_mask(img_bgr)
    elif method == "threshold":
        mask = _threshold_mask(img_bgr)
    else:
        logging.error(f"Unknown method: {method}")
        sys.exit(1)
        
    logging.info(f"Writing new mask to {mask_path}")
    cv2.imwrite(str(mask_path), mask)
    logging.info("Remask complete!")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python remask.py <out_dir> <method>")
        sys.exit(1)
        
    remask(sys.argv[1], sys.argv[2])
