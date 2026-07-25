import os
import random
import shutil
from pathlib import Path
import cv2
import numpy as np

def generate_padded_dataset(input_dir, output_dir, target_size=640, pad_probability=0.6):
    """
    Reads an existing pre-cropped YOLO pose dataset and applies random scaling and background
    padding to break bounding-box mode collapse.
    
    Parameters:
        input_dir (str or Path): Path to existing dataset root containing 'images/' and 'labels/'.
        output_dir (str or Path): Path where the Phase 2 augmented dataset will be constructed.
        target_size (int): Output canvas dimensions (default 640x640).
        pad_probability (float): Probability that an image undergoes scaling and canvas embedding (0.0 to 1.0).
    """
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    print(f"============================================================")
    print(f"   GENERATING PHASE 2 PADDED & AUGMENTED SKETCH DATASET   ")
    print(f"============================================================")
    print(f"[*] Source directory: {input_dir.resolve()}")
    print(f"[*] Target directory: {output_dir.resolve()}")
    print(f"[*] Canvas dimensions: {target_size}x{target_size} pixels")
    print(f"[*] Augmentation ratio: {pad_probability*100:.0f}% padded vs {(1-pad_probability)*100:.0f}% standard")

    if output_dir.exists():
        shutil.rmtree(output_dir)
        print(f"[!] Purged previous output folder at target path.")

    # Copy data.yaml if it exists
    src_yaml = input_dir / "data.yaml"
    if src_yaml.exists():
        output_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy(src_yaml, output_dir / "data.yaml")

    for split in ["train", "val"]:
        src_img_dir = input_dir / "images" / split
        src_lbl_dir = input_dir / "labels" / split
        
        dst_img_dir = output_dir / "images" / split
        dst_lbl_dir = output_dir / "labels" / split
        
        dst_img_dir.mkdir(parents=True, exist_ok=True)
        dst_lbl_dir.mkdir(parents=True, exist_ok=True)
        
        if not src_img_dir.exists():
            continue

        img_files = list(src_img_dir.glob("*.png")) + list(src_img_dir.glob("*.jpg"))
        print(f"\n[*] Processing [{split.upper()}] split: {len(img_files)} images...")

        for img_path in img_files:
            lbl_path = src_lbl_dir / f"{img_path.stem}.txt"
            dst_img = dst_img_dir / img_path.name
            dst_lbl = dst_lbl_dir / f"{img_path.stem}.txt"

            img = cv2.imread(str(img_path))
            if img is None or not lbl_path.exists():
                continue

            h_old, w_old, _ = img.shape
            
            # Read original label lines
            with open(lbl_path, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f.readlines() if l.strip()]

            # Determine whether to apply random padding/scaling or keep original resizing
            if random.random() < pad_probability:
                # Random scaling factor between 0.4 and 0.8 to fit inside target canvas
                scale = random.uniform(0.40, 0.80)
                w_s = int(w_old * scale)
                h_s = int(h_old * scale)
                
                # Maintain aspect ratio within canvas limit
                if w_s >= target_size or h_s >= target_size:
                    scale = (target_size - 40) / max(w_old, h_old)
                    w_s = int(w_old * scale)
                    h_s = int(h_old * scale)

                resized_img = cv2.resize(img, (w_s, h_s), interpolation=cv2.INTER_AREA)

                # Generate random offset within empty canvas space
                max_ox = max(0, target_size - w_s)
                max_oy = max(0, target_size - h_s)
                ox = random.randint(0, max_ox)
                oy = random.randint(0, max_oy)

                # Create white background canvas (standard for sketch papers)
                canvas = np.full((target_size, target_size, 3), 255, dtype=np.uint8)
                canvas[oy:oy+h_s, ox:ox+w_s] = resized_img
                cv2.imwrite(str(dst_img), canvas)

                # Modify annotations mathematically
                new_lines = []
                for line in lines:
                    parts = line.split()
                    cls_id = parts[0]
                    # Original bounding box (x_c, y_c, w, h)
                    x_c, y_c, bw, bh = map(float, parts[1:5])
                    
                    # Transform to pixel coordinates in scaled drawing
                    px_c = (x_c * w_old) * scale + ox
                    py_c = (y_c * h_old) * scale + oy
                    pbw  = (bw * w_old) * scale
                    pbh  = (bh * h_old) * scale
                    
                    # Normalize against new canvas size
                    nx_c = px_c / target_size
                    ny_c = py_c / target_size
                    nbw  = pbw / target_size
                    nbh  = pbh / target_size
                    
                    row_str = f"{cls_id} {nx_c:.6f} {ny_c:.6f} {nbw:.6f} {nbh:.6f}"

                    # Process 17 keypoints (x, y, visibility)
                    kpt_data = parts[5:]
                    for i in range(0, len(kpt_data), 3):
                        kx = float(kpt_data[i])
                        ky = float(kpt_data[i+1])
                        kv = kpt_data[i+2]
                        if kx != 0.0 or ky != 0.0:
                            nkx = ((kx * w_old) * scale + ox) / target_size
                            nky = ((ky * h_old) * scale + oy) / target_size
                            row_str += f" {nkx:.6f} {nky:.6f} {kv}"
                        else:
                            row_str += f" 0.000000 0.000000 {kv}"
                    new_lines.append(row_str)

                with open(dst_lbl, "w", encoding="utf-8") as f:
                    f.write("\n".join(new_lines) + "\n")

            else:
                # Direct file copy without padding (maintains multi-scale capability)
                shutil.copy(img_path, dst_img)
                shutil.copy(lbl_path, dst_lbl)

    print("\n[+] Phase 2 Padded Dataset generation complete at:", output_dir.resolve())
    
    # Compress output to zip for immediate Colab deployment
    zip_target = str(output_dir) + ".zip"
    if os.path.exists(zip_target):
        os.remove(zip_target)
    shutil.make_archive(str(output_dir), 'zip', output_dir)
    print(f"[+] Compressed deployment package created: {zip_target}")

if __name__ == "__main__":
    src_dataset = "C:/MajorProject-MVP/MajorProject-MVP/yolo_test/sketch_yolo_corrected"
    out_dataset = "C:/MajorProject-MVP/MajorProject-MVP/yolo_test/sketch_phase2_padded"
    
    if Path(src_dataset).exists():
        generate_padded_dataset(src_dataset, out_dataset, target_size=640, pad_probability=0.60)
    else:
        print(f"[!] Source dataset not found at {src_dataset}. Please verify folder location.")
