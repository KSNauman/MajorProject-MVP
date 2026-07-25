import os
import json
import shutil
import cv2
from pathlib import Path

def convert_yolo_subset_to_coco_zip(work_dir_str):
    work_dir = Path(work_dir_str)
    json_path = work_dir / "amateur_drawings_annotations.json"
    yolo_dataset_dir = work_dir / "sketch_yolo_dataset"
    coco_dataset_dir = work_dir / "sketch_coco_dataset"
    
    # Create target directory
    coco_dataset_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"[*] Loading original annotations from: {json_path}")
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    print("[*] Collecting IDs of the 1,200 extracted images...")
    train_labels = yolo_dataset_dir / "labels" / "train"
    val_labels = yolo_dataset_dir / "labels" / "val"
    
    extracted_ids = set()
    for folder in [train_labels, val_labels]:
        for txt_file in folder.glob("*.txt"):
            extracted_ids.add(int(txt_file.stem))
            
    print(f"[+] Found {len(extracted_ids)} local image IDs.")
    
    # Read actual image sizes from disk (images in YOLO dataset are downscaled to 512px max dimension)
    print("[*] Scanning image dimensions on disk...")
    image_dims = {}
    train_images_dir = yolo_dataset_dir / "images" / "train"
    val_images_dir = yolo_dataset_dir / "images" / "val"
    
    for folder in [train_images_dir, val_images_dir]:
        for img_path in folder.glob("*.png"):
            img_id = int(img_path.stem)
            img = cv2.imread(str(img_path))
            if img is not None:
                h, w = img.shape[:2]
                image_dims[img_id] = (w, h)
                
    # Filter images and set dimensions
    print("[*] Filtering JSON image records...")
    filtered_images = []
    
    for img in data.get('images', []):
        img_id = img['id']
        if img_id in extracted_ids:
            img_copy = img.copy()
            img_copy['file_name'] = f"{img_id}.png"
            
            if img_id in image_dims:
                act_w, act_h = image_dims[img_id]
                img_copy['width'] = act_w
                img_copy['height'] = act_h
            filtered_images.append(img_copy)
            
    # Filter and map keypoints to cropped space
    print("[*] Mapping keypoints from original to cropped/scaled image coordinate space...")
    filtered_annotations = []
    
    for ann in data.get('annotations', []):
        img_id = ann['image_id']
        if img_id in extracted_ids:
            ann_copy = ann.copy()
            
            if img_id in image_dims:
                act_w, act_h = image_dims[img_id]
                
                # Original cropping bbox
                l, t, w_bbox, h_bbox = ann['bbox']
                
                # Scale factors mapping cropped bbox to actual disk dimensions
                scale_x = act_w / w_bbox
                scale_y = act_h / h_bbox
                
                # 1. Bounding box in the new cropped image is the full image size
                ann_copy['bbox'] = [0, 0, act_w, act_h]
                
                # 2. Subtract bbox offset and scale keypoints
                if 'keypoints' in ann_copy and ann_copy['keypoints'] is not None:
                    kpts = ann_copy['keypoints'].copy()
                    for i in range(0, len(kpts), 3):
                        kx_orig, ky_orig, kv = kpts[i:i+3]
                        if kv > 0:
                            # Subtract bbox offset and scale
                            kx_new = (kx_orig - l) * scale_x
                            ky_new = (ky_orig - t) * scale_y
                            kpts[i] = kx_new
                            kpts[i+1] = ky_new
                    ann_copy['keypoints'] = kpts
                    
            filtered_annotations.append(ann_copy)
            
    coco_data = {
        "info": data.get("info", {}),
        "licenses": data.get("licenses", []),
        "categories": data.get("categories", []),
        "images": filtered_images,
        "annotations": filtered_annotations
    }
    
    # Write annotations.json
    coco_json_path = coco_dataset_dir / "annotations.json"
    with open(coco_json_path, 'w') as f:
        json.dump(coco_data, f)
    print(f"[+] Saved cropped COCO annotations.json to: {coco_json_path}")
    
    # Copy images to flat coco directory
    print("[*] Copying images to flat folder...")
    copy_count = 0
    for folder in [train_images_dir, val_images_dir]:
        for img_path in folder.glob("*.png"):
            dest_img_path = coco_dataset_dir / img_path.name
            shutil.copy(img_path, dest_img_path)
            copy_count += 1
            
    print(f"[+] Copied {copy_count} images to: {coco_dataset_dir}")
    
    # Zip the COCO dataset
    print("[*] Creating zip archive...")
    zip_path = shutil.make_archive(str(work_dir / "sketch_coco_dataset"), 'zip', str(coco_dataset_dir))
    print(f"[+] SUCCESS! Cropped COCO Dataset ZIP created at: {zip_path}")

if __name__ == "__main__":
    convert_yolo_subset_to_coco_zip("c:/MajorProject-MVP/MajorProject-MVP/yolo_test")
