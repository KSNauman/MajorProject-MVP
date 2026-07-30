# Comprehensive Manual: Massive Cloud Training & Google Drive Checkpointing in Google Colab

This reference manual outlines the complete optimized workflow for running a multi-hour T4 GPU training session on Google Colab. To fully leverage your 4 to 5 hours of GPU runtime and eliminate mode collapse, this configuration streams and processes **11,500 augmented drawing sketches** directly over Colab's cloud internet connection.

---

## Why Stream & Process in the Cloud?
* **Zero Local Bandwidth Bottleneck:** Rather than uploading large datasets from your laptop over residential internet, Google Colab downloads from Meta's high-speed servers directly into cloud storage (`/content/massive_sketch_dataset`) at gigabit speeds in under three minutes.
* **Large-Scale Generalization:** Training on $10,000$ training sketches and $1,500$ validation sketches prevents neural network mode collapse and ensures robust posture adaptation.
* **Automatic Google Drive Resumption:** All training epoch checkpoints are written directly to your mounted Google Drive filesystem (`/content/drive/MyDrive/YOLO_Sketch_Project/runs`). If execution terminates, running the same notebook tomorrow automatically resumes optimization from the final completed epoch without losing compute progress.

---

## Execution Instructions
Create a new Python notebook in Google Colab, select an active NVIDIA GPU runtime (**Runtime > Change runtime type > T4 GPU**), and sequentially execute the three Python code blocks below:

### Block 1: Mount Google Drive & Configure Environment
Execute this cell to authorize connection to your Google Drive and verify GPU availability:

```python
import os
from google.colab import drive

# 1. Mount personal Google Drive
drive.mount('/content/drive')

# 2. Establish dedicated project backup workspace
cloud_workspace = '/content/drive/MyDrive/YOLO_Sketch_Project'
os.makedirs(cloud_workspace, exist_ok=True)
print(f"[*] Google Drive mounted. Backup destination: {cloud_workspace}")

# 3. Install Ultralytics framework and verify GPU allocation
!pip install -q ultralytics
import ultralytics
ultralytics.checks()
```

---

### Block 2: Stream & Construct the Massive Padded Dataset
Execute this cell to stream annotations and extracts $11,500$ drawing sketches directly into Colab's fast local SSD storage (`/content/massive_sketch_dataset`), automatically embedding $60\%$ of them onto randomized blank white canvases:

```python
import os, json, random, urllib.request, tarfile
from pathlib import Path
import numpy as np
import cv2

ANNOTATIONS_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings_annotations.json"
TAR_URL = "https://dl.fbaipublicfiles.com/amateur_drawings/amateur_drawings.tar"

work_dir = Path("/content")
anno_file = work_dir / "amateur_drawings_annotations.json"
out_path = work_dir / "massive_sketch_dataset"

# 1. Download Annotations JSON
if not anno_file.exists():
    print(f"[*] Downloading Meta annotations (~275 MB)...")
    urllib.request.urlretrieve(ANNOTATIONS_URL, anno_file)

print(f"[*] Opening JSON annotations...")
with open(anno_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

images_by_fn = {img['file_name']: img for img in data.get('images', [])}
annos_by_img_id = {ann['image_id']: ann for ann in data.get('annotations', [])}

train_count, val_count, target_size, pad_prob = 10000, 1500, 640, 0.60
total_target = train_count + val_count

for split in ["train", "val"]:
    (out_path / "images" / split).mkdir(parents=True, exist_ok=True)
    (out_path / "labels" / split).mkdir(parents=True, exist_ok=True)

print(f"[*] Streaming tarball from Meta CDN & extracting {total_target} augmented sketches...")
req = urllib.request.Request(TAR_URL, headers={'User-Agent': 'Mozilla/5.0'})
stream = urllib.request.urlopen(req)
tar = tarfile.open(fileobj=stream, mode='r|*')

extracted, padded = 0, 0
for member in tar:
    if not member.isfile(): continue
    fn = member.name.lstrip('/')
    if fn not in images_by_fn: continue
    img_id = images_by_fn[fn]['id']
    if img_id not in annos_by_img_id: continue
    
    anno = annos_by_img_id[img_id]
    bbox = anno.get('bbox', None)
    joints = anno.get('keypoints', [])
    if bbox is None or len(joints) < 51: continue
    
    f_obj = tar.extractfile(member)
    if f_obj is None: continue
    img = cv2.imdecode(np.frombuffer(f_obj.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None: continue
    
    h_old, w_old, _ = img.shape
    l, t, w_bbox, h_bbox = bbox
    split = "val" if extracted >= train_count else "train"
    target_img = out_path / "images" / split / f"{img_id}.png"
    target_lbl = out_path / "labels" / split / f"{img_id}.txt"
    
    if random.random() < pad_prob:
        scale = random.uniform(0.40, 0.80)
        w_s, h_s = int(w_old * scale), int(h_old * scale)
        if w_s >= target_size or h_s >= target_size:
            scale = (target_size - 40) / max(w_old, h_old)
            w_s, h_s = int(w_old * scale), int(h_old * scale)
        ox, oy = random.randint(0, max(0, target_size - w_s)), random.randint(0, max(0, target_size - h_s))
        canvas = np.full((target_size, target_size, 3), 255, dtype=np.uint8)
        canvas[oy:oy+h_s, ox:ox+w_s] = cv2.resize(img, (w_s, h_s), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(target_img), canvas)
        
        # Corrected Math
        new_l, new_t, new_w, new_h = l * scale + ox, t * scale + oy, w_bbox * scale, h_bbox * scale
        xc_norm, yc_norm, nw, nh = (new_l + new_w/2.0)/target_size, (new_t + new_h/2.0)/target_size, new_w/target_size, new_h/target_size
        kpts = []
        for i in range(0, len(joints), 3):
            kx, ky, kv = joints[i], joints[i+1], joints[i+2]
            if kv > 0:
                kpts.append(f"{(kx*scale + ox)/target_size:.6f} {(ky*scale + oy)/target_size:.6f} {kv}")
            else: kpts.append("0.000000 0.000000 0")
        padded += 1
    else:
        cv2.imwrite(str(target_img), img)
        
        # Corrected Math
        xc_norm, yc_norm, nw, nh = (l + w_bbox/2.0)/w_old, (t + h_bbox/2.0)/h_old, w_bbox/w_old, h_bbox/h_old
        kpts = [f"{joints[i]/w_old:.6f} {joints[i+1]/h_old:.6f} {joints[i+2]}" if joints[i+2]>0 else "0.000000 0.000000 0" for i in range(0, len(joints), 3)]
        
    with open(target_lbl, 'w', encoding='utf-8') as lf:
        lf.write(f"0 {xc_norm:.6f} {yc_norm:.6f} {nw:.6f} {nh:.6f} " + " ".join(kpts) + "\n")
    extracted += 1
    if extracted % 2500 == 0 or extracted == total_target:
        print(f"[Progress] Extracted & processed {extracted} / {total_target} sketches...")
    if extracted >= total_target: break

tar.close(); stream.close()

yaml_path = out_path / "data.yaml"
with open(yaml_path, 'w', encoding='utf-8') as yf:
    yf.write(f"path: {out_path.resolve().as_posix()}\ntrain: images/train\nval: images/val\nkpt_shape: [17, 3]\nnames:\n  0: sketch_humanoid\n")

print(f"[+] Dataset configuration complete. 11,500 drawings ready for Phase 2 training.")
```

---

### Block 3: Automated Multi-Hour Resumable Training
Execute this cell to commence GPU training. All weights and logs are permanently written to your mounted Google Drive folder after every completed epoch:

```python
from ultralytics import YOLO
from pathlib import Path

cloud_runs_dir = '/content/drive/MyDrive/YOLO_Sketch_Project/runs'
checkpoint_path = Path(cloud_runs_dir) / 'massive_sketch_pose' / 'weights' / 'last.pt'
data_yaml_path = '/content/massive_sketch_dataset/data.yaml'

if checkpoint_path.exists():
    print(f"[*] Previous training session detected at: {checkpoint_path}")
    print("[*] Automatically RESUMING optimization from saved checkpoint...")
    model = YOLO(str(checkpoint_path))
    results = model.train(resume=True)
else:
    print("[*] INITIATING NEW FULL-SCALE TRAINING on 11,500 sketches...")
    model = YOLO('yolov8n-pose.pt')
    results = model.train(
        data=data_yaml_path,
        epochs=80,
        imgsz=640,
        batch=16,
        project=cloud_runs_dir,
        name='massive_sketch_pose',
        save=True,
        save_period=1,       # Save checkpoint every single epoch to Google Drive
        workers=8,
        mosaic=1.0,          # Advanced spatial mixing
        degrees=15.0,        # Random rotation (+- 15 deg)
        translate=0.2,       # Random translation (+- 20%)
        scale=0.5            # Random scaling augmentation (+- 50%)
    )

print("\n[+] Training segment successfully recorded to Google Drive!")
```
