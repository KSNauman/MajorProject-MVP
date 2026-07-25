import os
import json
import urllib.request
import tarfile
from pathlib import Path
import numpy as np

# URLs
ANNOTATIONS_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings_annotations.json"
TAR_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings.tar"

def download_annotations(dest_path):
    if not os.path.exists(dest_path):
        print(f"[*] Downloading Meta Amateur Drawings annotations (~275 MB)...")
        print(f"[*] Source: {ANNOTATIONS_URL}")
        urllib.request.urlretrieve(ANNOTATIONS_URL, dest_path)
        print(f"[+] Download complete: {dest_path}")
    else:
        print(f"[+] Found existing annotations file at: {dest_path}")

def convert_coco_bbox_to_yolo(bbox, img_w, img_h):
    """
    Convert COCO bounding box [left, top, width, height] to YOLO normalized [x_center, y_center, width, height].
    """
    l, t, w, h = bbox
    xc = (l + w / 2.0) / img_w
    yc = (t + h / 2.0) / img_h
    nw = w / img_w
    nh = h / img_h
    return xc, yc, nw, nh

def extract_and_convert_dataset(json_path, output_dir, train_count=1000, val_count=200):
    print(f"[*] Parsing annotations JSON: {json_path}")
    with open(json_path, 'r') as f:
        data = json.load(f)

    # Build lookup maps
    print("[*] Indexing images and annotations...")
    images_by_fn = {img['file_name']: img for img in data.get('images', [])}
    annos_by_img_id = {}
    for ann in data.get('annotations', []):
        annos_by_img_id[ann['image_id']] = ann

    print(f"[+] Indexed {len(images_by_fn)} images and {len(annos_by_img_id)} annotations.")

    # Setup directories
    out_path = Path(output_dir)
    train_labels = out_path / "labels" / "train"
    val_labels = out_path / "labels" / "val"
    train_images = out_path / "images" / "train"
    val_images = out_path / "images" / "val"

    for d in [train_labels, val_labels, train_images, val_images]:
        d.mkdir(parents=True, exist_ok=True)

    total_target = train_count + val_count
    print(f"[*] Streaming tarball from: {TAR_URL}")
    print(f"[*] Extracting up to {total_target} annotated drawings...")

    req = urllib.request.Request(TAR_URL, headers={'User-Agent': 'Mozilla/5.0'})
    stream = urllib.request.urlopen(req)
    tar = tarfile.open(fileobj=stream, mode='r|*')

    extracted_count = 0
    
    for member in tar:
        if not member.isfile():
            continue
            
        fn = member.name
        # Match standard file name in annotations
        if fn not in images_by_fn:
            # Try removing leading/trailing slashes if any
            fn_alt = fn.lstrip('/')
            if fn_alt not in images_by_fn:
                continue
            fn = fn_alt

        img_metadata = images_by_fn[fn]
        img_id = img_metadata['id']
        
        if img_id not in annos_by_img_id:
            continue
            
        anno = annos_by_img_id[img_id]
        bbox = anno.get('bbox', None)
        joints = anno.get('keypoints', [])
        
        if bbox is None or len(joints) == 0:
            continue

        # Decide split
        is_val = extracted_count >= train_count
        target_img_dir = val_images if is_val else train_images
        target_lbl_dir = val_labels if is_val else train_labels

        img_w = img_metadata['width']
        img_h = img_metadata['height']

        # Extract image content
        f_obj = tar.extractfile(member)
        if f_obj is None:
            continue
        img_data = f_obj.read()

        # Save image file
        img_file_path = target_img_dir / f"{img_id}.png"
        with open(img_file_path, 'wb') as img_f:
            img_f.write(img_data)

        # Convert annotations to YOLO format
        xc, yc, nw, nh = convert_coco_bbox_to_yolo(bbox, img_w, img_h)

        kpts_str = []
        for i in range(0, len(joints), 3):
            x = joints[i] / img_w
            y = joints[i+1] / img_h
            v = joints[i+2]
            kpts_str.append(f"{x:.6f} {y:.6f} {v}")

        label_file = target_lbl_dir / f"{img_id}.txt"
        with open(label_file, 'w') as lf:
            line = f"0 {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f} " + " ".join(kpts_str) + "\n"
            lf.write(line)

        extracted_count += 1
        if extracted_count % 100 == 0:
            print(f"[Progress] Extracted {extracted_count}/{total_target} drawings...")

        if extracted_count >= total_target:
            print("[+] All target drawings extracted successfully.")
            break

    tar.close()
    stream.close()

    print(f"[+] Dataset creation complete. Extracted {extracted_count} drawings.")

    # Create dataset yaml config
    yaml_content = f"""# Custom Sketch YOLOv8-Pose Dataset Configuration
path: {out_path.resolve().as_posix()}
train: images/train
val: images/val

# 17 COCO Keypoints
kpt_shape: [17, 3]

names:
  0: sketch_humanoid
"""
    yaml_path = out_path / "sketch_pose_dataset.yaml"
    with open(yaml_path, 'w') as yf:
        yf.write(yaml_content)

    print(f"[+] Created YOLO dataset YAML file at: {yaml_path}")

if __name__ == "__main__":
    work_dir = Path("c:/MajorProject-MVP/MajorProject-MVP/yolo_test")
    json_path = work_dir / "amateur_drawings_annotations.json"
    
    # Download annotations if missing
    download_annotations(str(json_path))
    
    # Convert annotations to YOLO dataset format and extract subset of images
    output_dataset_dir = work_dir / "sketch_yolo_dataset"
    extract_and_convert_dataset(str(json_path), str(output_dataset_dir), train_count=1000, val_count=200)
