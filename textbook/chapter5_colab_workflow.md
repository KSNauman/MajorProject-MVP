# Chapter 5: Google Colab Training Workflow

In this chapter, we document the exact, step-by-step interactive workflow we are executing right now to train our model in the cloud. This serves as a quick reference and tutorial for reproducing custom pose-estimation training runs.

---

## 1. Step-by-Step Training Protocol

Here is the chronological process for training a YOLOv8-pose model using Google Colab:

```
[ Step 1: Set up GPU ] ──> [ Step 2: Upload ZIP ] ──> [ Step 3: Unzip ]
                                                            │
[ Step 6: Download ] <── [ Step 5: Fine-tune ] <── [ Step 4: Install YOLO ]
```

### Step 1: GPU Activation
Google Colab provides a remote virtual machine equipped with an **NVIDIA T4 GPU**. We change the runtime type to GPU so PyTorch can use CUDA parallel processing, accelerating training by about $120\times$ compared to a standard CPU.

### Step 2: Dataset Upload
We upload the corrected YOLO dataset `sketch_yolo_corrected.zip` directly into Colab's local directory. 

### Step 3: Headless Decompression
We extract the ZIP archive silently to avoid printing thousands of log lines:
```bash
!unzip -q sketch_yolo_corrected.zip -d sketch_yolo_corrected
```

### Step 4: Install YOLO Framework
We install the `ultralytics` package to load the model layers and optimization functions:
```bash
!pip install ultralytics
```

### Step 5: Transfer Learning (Fine-Tuning)
We load the pre-trained `yolov8n-pose.pt` weights and run the training process for 50 epochs:
```python
from ultralytics import YOLO

# Load base model (already knows human structure)
model = YOLO('yolov8n-pose.pt')

# Train on custom sketch dataset
model.train(
    data='sketch_yolo_corrected/sketch_yolo_corrected/data.yaml',
    epochs=50,
    imgsz=640,
    batch=16,
    device=0  # GPU device index
)
```

### Step 6: Export & Weight Retrieval
Once training completes, the model saves the best weights at `runs/pose/train/weights/best.pt`. We zip and download this file to our local PC:
```python
!zip -r sketch_weights.zip runs/pose/train/weights/best.pt

from google.colab import files
files.download('sketch_weights.zip')
```

---

## 2. Training Metrics Checklist

During training, we monitor the following logs to verify model health:

* **Optimizer Selection:** YOLOv8 automatically selects `AdamW` (with weight decay) to optimize gradient updates.
* **AMP (Automatic Mixed Precision):** Enables 16-bit floating point calculations alongside 32-bit to speed up GPU memory bandwidth.
* **Epoch Loops:** Each epoch shows a progress bar indicating:
  * `GPU_mem`: VRAM footprint (should be $\sim 2.8$ GB).
  * `box_loss` & `pose_loss`: Training error values (must steadily decrease).
  * `mAP50` (Box & Pose): Validation precision scores (must steadily increase).
