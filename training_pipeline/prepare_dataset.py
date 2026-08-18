"""
Meta Amateur Drawings Dataset (ADD) Downloader & Preprocessor for YOLOv8-Pose.
Converts Meta ADD annotations into normalized YOLOv8 keypoint format:
<class> <x_center> <y_center> <width> <height> <px1> <py1> <v1> ... <px17> <py17> <v17>
"""
import os
import json
import urllib.request
import tarfile
import random
from pathlib import Path

DATASET_ROOT = Path(__file__).parent.parent / "datasets" / "sketch_humanoids"
ANNOTATIONS_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings_annotations.json"
IMAGES_TAR_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings.tar"

def download_dataset():
    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    json_path = DATASET_ROOT / "annotations.json"
    tar_path = DATASET_ROOT / "amateur_drawings.tar"

    if not json_path.exists():
        print(f"[*] Downloading Meta ADD Annotations (~275 MB) from:\n    {ANNOTATIONS_URL}")
        urllib.request.urlretrieve(ANNOTATIONS_URL, json_path)
        print("[SUCCESS] Downloaded annotations.json")

    if not tar_path.exists() and not (DATASET_ROOT / "images").exists():
        print(f"[*] Downloading Meta ADD Images archive from:\n    {IMAGES_TAR_URL}")
        urllib.request.urlretrieve(IMAGES_TAR_URL, tar_path)
        print("[SUCCESS] Downloaded amateur_drawings.tar")
        print("[*] Extracting images...")
        with tarfile.open(tar_path, 'r') as tar:
            tar.extractall(path=DATASET_ROOT / "images")
        print("[SUCCESS] Images extracted.")

def convert_meta_json_to_yolo(json_path: Path, output_dir: Path, split_ratio=(0.8, 0.1, 0.1)):
    """
    Reads COCO/Meta JSON annotations and exports images + label txt files in YOLOv8-pose structure.
    """
    if not json_path.exists():
        print(f"[ERROR] Annotation JSON {json_path} does not exist.")
        return

    print(f"[*] Reading annotations from {json_path}...")
    with open(json_path, 'r') as f:
        data = json.load(f)

    images_info = {img['id']: img for img in data.get('images', [])}
    annotations = data.get('annotations', [])

    print(f"[*] Total images in dataset: {len(images_info)}, Total annotations: {len(annotations)}")

    for split in ['train', 'val', 'test']:
        (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    img_ids = list(images_info.keys())
    random.seed(42)
    random.shuffle(img_ids)

    n_total = len(img_ids)
    n_train = int(n_total * split_ratio[0])
    n_val = int(n_total * split_ratio[1])

    split_map = {}
    for i, img_id in enumerate(img_ids):
        if i < n_train:
            split_map[img_id] = 'train'
        elif i < n_train + n_val:
            split_map[img_id] = 'val'
        else:
            split_map[img_id] = 'test'

    img_anno_map = {}
    for anno in annotations:
        image_id = anno['image_id']
        if image_id not in img_anno_map:
            img_anno_map[image_id] = []
        img_anno_map[image_id].append(anno)

    processed_count = 0
    for img_id, img_data in images_info.items():
        split = split_map[img_id]
        file_name = img_data['file_name']
        width = img_data['width']
        height = img_data['height']

        annos = img_anno_map.get(img_id, [])
        if not annos:
            continue

        label_lines = []
        for anno in annos:
            bbox = anno['bbox']
            keypoints = anno.get('keypoints', [])

            x, y, w, h = bbox
            x_center = (x + w / 2.0) / width
            y_center = (y + h / 2.0) / height
            norm_w = w / width
            norm_h = h / height

            kpt_line = []
            for k in range(0, len(keypoints), 3):
                kx = keypoints[k] / width
                ky = keypoints[k+1] / height
                kv = keypoints[k+2]
                kx = min(max(kx, 0.0), 1.0)
                ky = min(max(ky, 0.0), 1.0)
                kv_flag = 2 if kv > 0 else 0
                kpt_line.extend([f"{kx:.6f}", f"{ky:.6f}", str(kv_flag)])

            line = f"0 {x_center:.6f} {y_center:.6f} {norm_w:.6f} {norm_h:.6f} " + " ".join(kpt_line)
            label_lines.append(line)

        txt_name = Path(file_name).stem + ".txt"
        with open(output_dir / "labels" / split / txt_name, 'w') as f:
            f.write("\n".join(label_lines) + "\n")

        processed_count += 1

    print(f"[SUCCESS] Converted {processed_count} annotations into YOLO pose format at {output_dir}")

if __name__ == '__main__':
    download_dataset()
    json_ann = DATASET_ROOT / "annotations.json"
    if json_ann.exists():
        convert_meta_json_to_yolo(json_ann, DATASET_ROOT)
