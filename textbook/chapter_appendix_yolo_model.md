# YOLOv8-Pose Sketch Model Training Configuration & Parameters

This document details the architecture, hyperparameters, loss functions, and evaluation metrics used to train the custom **YOLOv8-Pose** model for children's drawings.

---

## 1. Model Architecture
We are fine-tuning **YOLOv8n-pose** (Nano Pose model), designed by Ultralytics.
* **Layers:** 145
* **Parameters:** 3.3 Million (3,295,470 weights)
* **GFLOPs (Computing Complexity):** 9.3 GFLOPs
* **Design Philosophy:** Anchor-free detection head coupled with direct coordinate regression for keypoint estimation.

---

## 2. Dataset Configuration
* **Total Training Set:** 1,000 hand-drawn images
* **Total Validation Set:** 200 hand-drawn images
* **Class Names:** `0: sketch_humanoid`
* **Keypoints Shape:** `[17, 3]` (17 coordinates: x, y, and visibility confidence)
* **Keypoint Labels (COCO format):**
  `nose`, `left_eye`, `right_eye`, `left_ear`, `right_ear`, `left_shoulder`, `right_shoulder`, `left_elbow`, `right_elbow`, `left_wrist`, `right_wrist`, `left_hip`, `right_hip`, `left_knee`, `right_knee`, `left_ankle`, `right_ankle`

---

## 3. Hyperparameters & Settings
These parameters are fed into the training script `model.train()` in Google Colab:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `'yolov8n-pose.pt'` | Pretrained base weights from the COCO dataset to leverage transfer learning. |
| `epochs` | `50` | Number of times the model will see and learn from the entire training dataset. |
| `imgsz` | `640` | Resolution to resize images to during training ($640 \times 640$ pixels). |
| `batch` | `16` | Number of images processed per gradient update. |
| `device` | `0` | Directs the PyTorch optimizer to use GPU 0 (Tesla T4). |
| `optimizer` | `'AdamW'` | Automatically selected optimizer with weight decay to prevent overfitting. |
| `lr0` | `0.002` | Initial learning rate for gradient updates. |
| `momentum` | `0.9` | Optimizer momentum to speed up updates in correct directions. |
| `workers` | `8` | Number of CPU dataloader threads reading images in parallel. |

---

## 4. Multi-Task Loss Functions
YOLOv8-Pose calculates a combined loss function consisting of five components to balance box detection, pose estimation, and class categorization:

1. **`box_loss` (Weight: 7.5)**
   * **Algorithm:** Complete Intersection-over-Union (CIoU) Loss.
   * **Purpose:** Measures the overlap, distance between center points, and aspect ratio of predicted bounding boxes versus the ground truth.
2. **`pose_loss` (Weight: 12.0)**
   * **Algorithm:** Object Keypoint Similarity (OKS) Loss.
   * **Purpose:** Measures the Euclidean distance between predicted joint coordinates and actual joints, scaled by a standard deviation factor for each joint type.
3. **`kobj_loss` (Weight: 1.0)**
   * **Algorithm:** Binary Cross-Entropy Loss.
   * **Purpose:** Measures joint visibility objectness (predicting whether a joint is visible, obscured, or not present).
4. **`cls_loss` (Weight: 0.5)**
   * **Algorithm:** Binary Cross-Entropy (BCE) Loss.
   * **Purpose:** Measures classification error (distinguishing the `sketch_humanoid` class from the background).
5. **`dfl_loss` (Weight: 1.5)**
   * **Algorithm:** Distribution Focal Loss.
   * **Purpose:** Optimizes the regression boundaries for bounding boxes when edges are blurry or ambiguous (essential for children's drawings).

---

## 5. Evaluation Metrics
We log these metrics during validation at the end of each training epoch:
* **Precision (P):** Percentage of correct positive predictions out of all positive predictions.
* **Recall (R):** Percentage of actual positive objects successfully found by the model.
* **mAP50:** Mean Average Precision calculated at a 50% IoU / OKS threshold. This is the primary metric for testing object and joint detection accuracy.
* **mAP50-95:** Average mAP calculated across multiple IoU thresholds (from 50% to 95% in steps of 5%), showing the spatial precision of the predictions.
