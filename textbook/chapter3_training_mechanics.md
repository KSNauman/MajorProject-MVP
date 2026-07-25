# Chapter 3: Deep Learning Training & Performance Mechanics

In this chapter, we explore how neural networks optimize their weights during training. We will cover transfer learning, cloud GPU performance, dataset partitioning, and how to read evaluation graphs and loss metrics.

---

## 1. Transfer Learning (Fine-Tuning)

Training a deep neural network from scratch requires huge amounts of data (often millions of annotated images) and massive computing power. **Transfer Learning** is a technique where we take a model already trained on a large dataset (source task) and adapt it to a new, smaller dataset (target task).

* **Pretrained Base:** We start with `yolov8n-pose.pt`, which has already trained on 200,000 photos of humans (COCO dataset). It has learned generic visual features like edges, curves, limbs, and facial structures.
* **Fine-Tuning:** We keep the early feature-extraction layers frozen or slightly adjustable, and train the final prediction layers on our 1,200 drawings. This adapts the model's visual "brain" to understand pencil strokes and childlike sketch proportions instead of real human photos.

---

## 2. Cloud GPU Performance (Tesla T4)

Google Colab provides a free **Nvidia Tesla T4 GPU** with 16 GB of VRAM. 
* **Parallel Processing:** Unlike a CPU, which processes loops sequentially, a GPU has 2,560 CUDA cores that process batches of images (e.g. 16 images at a time) in parallel.
* **Training Speed:** Fine-tuning our model on a CPU would take **30 to 50 minutes per epoch** (totaling ~30 hours). On the Tesla T4 GPU, training runs at **3.6 iterations per second**, completing an epoch in **20 seconds** (totaling ~12 minutes for 50 epochs).

---

## 3. Dataset Partitioning (Splits)

To train and evaluate a model correctly, we split our 1,200 images into three separate subsets:

```
[ Total Dataset: 1,200 Images ]
       ├── Training Set (80% / 960 images)   --> Model looks at these to adjust its weights.
       ├── Validation Set (15% / 180 images) --> Model tests itself here after each epoch to check progress.
       └── Testing Set (5% / 60 images)      --> Kept hidden until the end to measure final performance.
```

* **The Validation Rule:** The network is never allowed to look at the validation set during backpropagation. This ensures that the validation metrics show whether the model is actually *learning concepts* rather than just *memorizing images* (overfitting).

---

## 4. Evaluating Loss & Accuracy Metrics

During training, YOLO prints metrics that help us evaluate the model's performance:

### A. Box Loss vs. Pose Loss
* **`box_loss` (CIoU):** Bounding box alignment error. It should drop quickly below `0.3`, indicating the model is highly confident in finding the character.
* **`pose_loss` (OKS):** Keypoint coordinate error. This is a harder mathematical problem and will drop more slowly, indicating the model is refining joint placement.

### B. Validation Accuracy Metrics
* **Precision (P):** *"Of all the characters I detected, how many were actually characters?"* (Fewer false positives).
* **Recall (R):** *"Of all the characters in the images, how many did I successfully find?"* (Fewer false negatives).
* **mAP50 (Mean Average Precision):** The primary benchmark. Measures the area under the Precision-Recall curve at a 50% overlap tolerance (IoU/OKS).
  * A **Box mAP50** near `0.99` (99%) indicates nearly perfect character cropping.
  * A **Pose mAP50** starting at `0.06` (6%) and climbing toward `0.3` or `0.5` shows that the model is successfully learning to locate joints on sketches.

---

## 5. Overfitting & Early Stopping

* **Overfitting:** Occurs when a model trains for too many epochs. It begins to memorize specific training sketches (like a smudge or a specific line) instead of learning generalized features (like "human arms are connected to shoulders"). When overfitting happens, training loss continues to drop, but validation loss starts to rise.
* **Early Stopping:** YOLOv8 automatically saves the weights file at the epoch that achieved the **highest validation mAP**, preventing overfitting. This is why we export the file `best.pt` rather than `last.pt`.
