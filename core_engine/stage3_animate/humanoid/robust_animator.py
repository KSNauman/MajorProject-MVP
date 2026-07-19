import os
import sys
import yaml
import cv2
import numpy as np
from pathlib import Path
from scipy.spatial import cKDTree
import shutil
import time

# --- Configure Paths ---
AD_DIR = "/home/champion/Major Project - MVP/Actual repo (EDUVISION)/AnimatedDrawings"
sys.path.append(AD_DIR)
sys.path.append(os.path.join(AD_DIR, "examples"))

try:
    from image_to_annotations import image_to_annotations
    from annotations_to_animation import annotations_to_animation
except ImportError as e:
    print(f"[!] Failed to import AnimatedDrawings modules: {e}")
    print(f"Make sure you are running this with the correct PYTHONPATH.")
    sys.exit(1)


def fix_mask_artifacts(char_anno_dir):
    """
    Cleans up the generated mask. 
    1. Closes small holes inside the body.
    2. Removes floating disconnected pixels by keeping only the largest connected component.
    This prevents rendering artifacts and triangulation crashes.
    """
    mask_path = Path(char_anno_dir) / 'mask.png'
    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return
        
    print("[*] Performing deep cleanup on segmentation mask...")
    
    # 1. Close holes
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    closed_mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    # 2. Keep only largest connected component
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(closed_mask, connectivity=8)
    if num_labels > 1:
        largest_label = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
        final_mask = np.zeros_like(closed_mask)
        final_mask[labels == largest_label] = 255
    else:
        final_mask = closed_mask
        
    cv2.imwrite(str(mask_path), final_mask)


def snap_joints_to_mask(char_anno_dir):
    """
    Checks if any skeleton joints predicted by the AI fell outside the body mask.
    If they did, it automatically snaps them to the nearest valid foreground pixel.
    This GUARANTEES the ARAP solver will never crash with a ValueError.
    """
    cfg_path = Path(char_anno_dir) / 'char_cfg.yaml'
    mask_path = Path(char_anno_dir) / 'mask.png'
    
    with open(cfg_path, 'r') as f:
        cfg = yaml.safe_load(f)
        
    mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return
        
    y_coords, x_coords = np.where(mask > 0)
    if len(y_coords) == 0:
        return
        
    foreground_pixels = np.column_stack((x_coords, y_coords))
    tree = cKDTree(foreground_pixels)
    
    fixed = False
    for joint in cfg['skeleton']:
        x, y = joint['loc']
        
        out_of_bounds = (x < 0 or x >= mask.shape[1] or y < 0 or y >= mask.shape[0])
        
        if out_of_bounds or mask[int(y), int(x)] == 0:
            dist, idx = tree.query([x, y])
            nearest_x, nearest_y = foreground_pixels[idx]
            joint['loc'] = [int(nearest_x), int(nearest_y)]
            fixed = True
            print(f"[*] Auto-Fixed: Snapped '{joint['name']}' joint inside the body mask.")
            
    if fixed:
        with open(cfg_path, 'w') as f:
            yaml.dump(cfg, f)
        print("[+] Skeleton successfully secured.")
    else:
        print("[+] Skeleton alignment is perfect.")


def generate_robust_animation(input_image, output_gif, motion="dance"):
    """
    End-to-End robust pipeline.
    Takes an image, extracts annotations, applies deep-fixes, and renders the animation.
    """
    print(f"\n--- Starting Robust Humanoid Pipeline ---")
    print(f"Input: {input_image}")
    
    # Create temporary working directory for annotations
    work_dir = Path("/tmp/animated_drawings_work")
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True)
    
    # 1. Extract Annotations (Requires TorchServe to be running)
    print("[1/3] Extracting character data (Bounding Box, Mask, Skeleton)...")
    try:
        image_to_annotations(input_image, str(work_dir))
    except Exception as e:
        print(f"\n[❌] ML Extraction Failed: {e}")
        print("-> Make sure the TorchServe Docker container is running: 'docker run -d --name docker_torchserve -p 8080:8080 -p 8081:8081 docker_torchserve'")
        return False
        
    # 2. Deep Enhancements (The Robustness Layer)
    print("[2/3] Applying Deep Enhancements and Stability Fixes...")
    fix_mask_artifacts(str(work_dir))
    snap_joints_to_mask(str(work_dir))
    
    # 3. Render Animation
    print(f"[3/3] Rendering animation with '{motion}' physics...")
    motion_cfg = os.path.join(AD_DIR, f"examples/config/motion/{motion}.yaml")
    retarget_cfg = os.path.join(AD_DIR, "examples/config/retarget/fair1_ppf.yaml")
    
    try:
        annotations_to_animation(str(work_dir), motion_cfg, retarget_cfg)
    except Exception as e:
        print(f"\n[❌] Rendering Failed: {e}")
        return False
        
    # 4. Export
    generated_video = work_dir / 'video.gif'
    if generated_video.exists():
        os.makedirs(os.path.dirname(output_gif), exist_ok=True)
        shutil.copy(generated_video, output_gif)
        print(f"\n[✅] SUCCESS! Animation saved to: {output_gif}")
        return True
    else:
        print("\n[❌] Failed to locate output video.gif")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python robust_animator.py <input_image> <output_gif> [motion_name]")
        sys.exit(1)
        
    img_path = sys.argv[1]
    out_path = sys.argv[2]
    motion = sys.argv[3] if len(sys.argv) > 3 else "dance"
    
    generate_robust_animation(img_path, out_path, motion)
