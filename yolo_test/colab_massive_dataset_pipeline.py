import os
import json
import random
import urllib.request
import tarfile
from pathlib import Path
import numpy as np
import cv2

# Meta Amateur Drawings CDN URLs
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

def stream_and_generate_massive_dataset(json_path, output_dir, train_count=10000, val_count=1500, target_size=640, pad_prob=0.60):
    """
    Streams drawings directly from Meta's CDN, extracts a large scale dataset (default 11,500 images),
    and applies random scaling and white canvas padding to break model overfitting and mode collapse.
    """
    print(f"============================================================")
    print(f"   MASSIVE CLOUD DATASET STREAMING & AUGMENTATION PIPELINE   ")
    print(f"============================================================")
    print(f"[*] Target Train Count: {train_count} | Val Count: {val_count}")
    print(f"[*] Total Extraction Target: {train_count + val_count} sketches")
    print(f"[*] Spatial Padding Augmentation Probability: {pad_prob*100:.0f}%")
    
    out_path = Path(output_dir)
    for split in ["train", "val"]:
        (out_path / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_path / "labels" / split).mkdir(parents=True, exist_ok=True)

    print(f"[*] Loading annotations JSON from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    images_by_fn = {img['file_name']: img for img in data.get('images', [])}
    annos_by_img_id = {ann['image_id']: ann for ann in data.get('annotations', [])}
    print(f"[+] Loaded metadata for {len(images_by_fn)} sketches.")

    total_target = train_count + val_count
    extracted_count = 0
    padded_count = 0

    print(f"[*] Opening high-speed streaming connection to: {TAR_URL}")
    req = urllib.request.Request(TAR_URL, headers={'User-Agent': 'Mozilla/5.0'})
    stream = urllib.request.urlopen(req)
    tar = tarfile.open(fileobj=stream, mode='r|*')

    for member in tar:
        if not member.isfile():
            continue

        fn = member.name
        if fn not in images_by_fn:
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
        if bbox is None or len(joints) < 51:
            continue

        f_obj = tar.extractfile(member)
        if f_obj is None:
            continue
        img_bytes = f_obj.read()
        
        # Decode drawing byte array directly to OpenCV BGR matrix
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            continue

        h_old, w_old, _ = img.shape
        l, t, w_bbox, h_bbox = bbox

        is_val = extracted_count >= train_count
        split = "val" if is_val else "train"
        target_img = out_path / "images" / split / f"{img_id}.png"
        target_lbl = out_path / "labels" / split / f"{img_id}.txt"

        # Apply spatial variance augmentation
        if random.random() < pad_prob:
            scale = random.uniform(0.40, 0.80)
            w_s = int(w_old * scale)
            h_s = int(h_old * scale)
            if w_s >= target_size or h_s >= target_size:
                scale = (target_size - 40) / max(w_old, h_old)
                w_s = int(w_old * scale)
                h_s = int(h_old * scale)

            max_ox = max(0, target_size - w_s)
            max_oy = max(0, target_size - h_s)
            ox = random.randint(0, max_ox)
            oy = random.randint(0, max_oy)

            canvas = np.full((target_size, target_size, 3), 255, dtype=np.uint8)
            canvas[oy:oy+h_s, ox:ox+w_s] = cv2.resize(img, (w_s, h_s), interpolation=cv2.INTER_AREA)
            cv2.imwrite(str(target_img), canvas)

            # Correct YOLO bounding box (wrapping the actual ink, not the whole image)
            new_l = l * scale + ox
            new_t = t * scale + oy
            new_w = w_bbox * scale
            new_h = h_bbox * scale
            
            xc_norm = (new_l + new_w / 2.0) / target_size
            yc_norm = (new_t + new_h / 2.0) / target_size
            nw = new_w / target_size
            nh = new_h / target_size

            kpts_str = []
            for i in range(0, len(joints), 3):
                kx_orig, ky_orig, kv = joints[i], joints[i+1], joints[i+2]
                if kv > 0:
                    nkx = (kx_orig * scale + ox) / target_size
                    nky = (ky_orig * scale + oy) / target_size
                    kpts_str.append(f"{nkx:.6f} {nky:.6f} {kv}")
                else:
                    kpts_str.append(f"0.000000 0.000000 0")
            padded_count += 1
        else:
            cv2.imwrite(str(target_img), img)
            
            # Correct YOLO bounding box for unpadded original image
            xc_norm = (l + w_bbox / 2.0) / w_old
            yc_norm = (t + h_bbox / 2.0) / h_old
            nw = w_bbox / w_old
            nh = h_bbox / h_old

            kpts_str = []
            for i in range(0, len(joints), 3):
                kx_orig, ky_orig, kv = joints[i], joints[i+1], joints[i+2]
                if kv > 0:
                    nkx = kx_orig / w_old
                    nky = ky_orig / h_old
                    kpts_str.append(f"{nkx:.6f} {nky:.6f} {kv}")
                else:
                    kpts_str.append(f"0.000000 0.000000 0")

        with open(target_lbl, 'w', encoding='utf-8') as lf:
            lf.write(f"0 {xc_norm:.6f} {yc_norm:.6f} {nw:.6f} {nh:.6f} " + " ".join(kpts_str) + "\n")

        extracted_count += 1
        if extracted_count % 500 == 0 or extracted_count == total_target:
            print(f"[Progress] Generated {extracted_count} / {total_target} sketches ({padded_count} spatially augmented)...")

        if extracted_count >= total_target:
            break

    tar.close()
    stream.close()

    yaml_content = f"""# Massive Phase 2 Sketch YOLOv8-Pose Dataset
path: {out_path.resolve().as_posix()}
train: images/train
val: images/val

kpt_shape: [17, 3]

names:
  0: sketch_humanoid
"""
    yaml_path = out_path / "data.yaml"
    with open(yaml_path, 'w', encoding='utf-8') as yf:
        yf.write(yaml_content)

    print(f"\n[+] SUCCESS: Massive dataset complete at {out_path.resolve()}")
    print(f"[+] Total Padded/Augmented Images: {padded_count} ({padded_count/extracted_count*100:.1f}%)")
    print(f"[+] Dataset Configuration YAML saved to: {yaml_path}")

if __name__ == "__main__":
    work_directory = Path("/content") if os.path.exists("/content") else Path("c:/MajorProject-MVP/MajorProject-MVP/yolo_test")
    anno_file = work_directory / "amateur_drawings_annotations.json"
    dataset_destination = work_directory / "massive_sketch_dataset"

    download_annotations(str(anno_file))
    stream_and_generate_massive_dataset(
        json_path=str(anno_file),
        output_dir=str(dataset_destination),
        train_count=10000,
        val_count=1500,
        target_size=640,
        pad_prob=0.60
    )
