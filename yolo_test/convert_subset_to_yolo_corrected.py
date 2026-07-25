import os
import json
import shutil
from pathlib import Path

def convert_yolo_subset_to_corrected_yolo_zip(work_dir_str):
    work_dir = Path(work_dir_str)
    json_path = work_dir / "amateur_drawings_annotations.json"
    yolo_dataset_dir = work_dir / "sketch_yolo_dataset"
    corrected_yolo_dir = work_dir / "sketch_yolo_corrected"
    
    # Create target directories
    (corrected_yolo_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    (corrected_yolo_dir / "images" / "val").mkdir(parents=True, exist_ok=True)
    (corrected_yolo_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
    (corrected_yolo_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
    
    print(f"[*] Loading original annotations from: {json_path}")
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    print("[*] Collecting IDs of the 1,200 extracted images...")
    train_labels_dir = yolo_dataset_dir / "labels" / "train"
    val_labels_dir = yolo_dataset_dir / "labels" / "val"
    
    extracted_ids = set()
    for folder in [train_labels_dir, val_labels_dir]:
        for txt_file in folder.glob("*.txt"):
            extracted_ids.add(int(txt_file.stem))
            
    print(f"[+] Found {len(extracted_ids)} local image IDs.")
    
    # Build annotation lookup
    print("[*] Indexing annotations...")
    annos_by_img_id = {ann['image_id']: ann for ann in data.get('annotations', [])}
    
    # Process images and generate corrected labels
    print("[*] Generating corrected YOLO labels...")
    
    splits = [("train", train_labels_dir), ("val", val_labels_dir)]
    for split_name, source_lbl_dir in splits:
        source_img_dir = yolo_dataset_dir / "images" / split_name
        dest_img_dir = corrected_yolo_dir / "images" / split_name
        dest_lbl_dir = corrected_yolo_dir / "labels" / split_name
        
        for source_img_path in source_img_dir.glob("*.png"):
            img_id = int(source_img_path.stem)
            
            # Copy image
            shutil.copy(source_img_path, dest_img_dir / source_img_path.name)
            
            # Get original annotation
            if img_id not in annos_by_img_id:
                continue
            
            anno = annos_by_img_id[img_id]
            l, t, w_bbox, h_bbox = anno['bbox']
            joints = anno['keypoints']
            
            # Since the image is cropped to the bbox, the character spans the full image.
            # Bounding box is centered at 0.5, 0.5 with width 1.0, height 1.0.
            xc, yc, nw, nh = 0.5, 0.5, 1.0, 1.0
            
            # Normalize keypoints relative to the cropped bounding box dimensions
            kpts_str = []
            for i in range(0, len(joints), 3):
                kx_orig, ky_orig, kv = joints[i:i+3]
                if kv > 0:
                    # Subtract offset and normalize by bbox dimensions
                    x_norm = (kx_orig - l) / w_bbox
                    y_norm = (ky_orig - t) / h_bbox
                    # Clamp to [0.0, 1.0] for safety
                    x_norm = max(0.0, min(1.0, x_norm))
                    y_norm = max(0.0, min(1.0, y_norm))
                    kpts_str.append(f"{x_norm:.6f} {y_norm:.6f} {kv}")
                else:
                    kpts_str.append(f"0.000000 0.000000 0")
                    
            # Write new label file
            dest_lbl_path = dest_lbl_dir / f"{img_id}.txt"
            with open(dest_lbl_path, 'w') as f:
                f.write(f"0 {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f} " + " ".join(kpts_str) + "\n")
                
    # Create dataset yaml config
    yaml_content = f"""# Corrected Sketch YOLOv8-Pose Dataset Configuration
path: ./sketch_yolo_corrected
train: images/train
val: images/val

# 17 COCO Keypoints
kpt_shape: [17, 3]

names:
  0: sketch_humanoid
"""
    with open(corrected_yolo_dir / "data.yaml", 'w') as f:
        f.write(yaml_content)
        
    print("[*] Creating zip archive...")
    zip_path = shutil.make_archive(str(work_dir / "sketch_yolo_corrected"), 'zip', str(corrected_yolo_dir))
    print(f"[+] SUCCESS! Corrected YOLO Dataset ZIP created at: {zip_path}")

if __name__ == "__main__":
    convert_yolo_subset_to_corrected_yolo_zip("c:/MajorProject-MVP/MajorProject-MVP/yolo_test")
