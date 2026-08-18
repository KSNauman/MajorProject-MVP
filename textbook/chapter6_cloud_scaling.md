# Chapter 6: Massive Cloud Scaling & Spatial Padding Augmentation

In this chapter, we document the architectural upgrades designed to overcome neural network mode collapse and fully leverage Google Colab's compute capacity. We shifted from a local 1,200-image zip extraction to a 11,500-image cloud-streaming pipeline.

---

## 1. The Mode Collapse Problem

When evaluating our initially trained YOLOv8 model on actual user sketches, a striking anomaly was observed: **The predicted skeleton always defaulted to an identical, rigid A-pose template, regardless of the character's actual drawn posture.**

### Root Cause Analysis:
1. **100% Cropped Dataset Bias:** Every training image curated from Meta's original dataset was tightly pre-cropped to the boundaries of the character. Therefore, every bounding box label in the dataset occupied exactly `1.0, 1.0` of the canvas.
2. **Lack of Visual Feature Grounding:** The neural network learned an optimization shortcut. Instead of learning to visually locate hand-drawn elbows or wrists, it learned to detect a bounding box over the entire paper and drop the statistical "average" geometric pose coordinates into that box. 
3. **Dataset Scale:** Training on only 1,200 images did not expose the model to enough diverse postures (e.g., characters running, jumping, bending) to prevent the network from memorizing the mean structural template.

---

## 2. Solution: Pipeline Restructuring

To resolve this limitation, we engineered a fully automated cloud pipeline to increase both the **scale** and **spatial variance** of the dataset during training.

### A. Cloud Gigabit Streaming
Instead of generating a massive dataset on local home Wi-Fi and uploading a multi-gigabyte ZIP file, our pipeline uses `urllib.request` inside Google Colab to connect directly to Meta's CDN servers. This extracts 11,500 drawings directly into Colab's high-speed local NVMe SSD storage (`/content/massive_sketch_dataset`) in approximately three minutes.

### B. Spatial Padding & Scale Augmentation
To break the bounding box regression bias, we injected mathematical spatial augmentation directly into the extraction pipeline:
* **Probability Gate:** $60\%$ of all drawings streamed from the tarball are selected for padding.
* **Canvas Embedding:** The selected sketches are randomly scaled down (between $40\%$ and $80\%$ of their original size) and pasted onto random $(X, Y)$ coordinates within a blank $640 \times 640$ white canvas.
* **Coordinate Re-Mapping:** The corresponding target bounding boxes and 17 skeleton keypoint coordinates are mathematically transformed to match their new absolute canvas locations. 

This forces the YOLOv8 detector to actively search for the sketch boundary on a larger canvas, rather than defaulting to $100\%$ width and height.

---

## 3. Persistent Checkpointing (Google Drive)

Because our dataset scale increased $10\times$, training now requires the full 4-to-5 hour T4 GPU allocation provided by Google Colab's free tier. 

To prevent data loss if a session terminates prematurely, we integrated the Google Drive filesystem directly into the Colab training script:
```python
from google.colab import drive
drive.mount('/content/drive')
```
By directing the YOLO training outputs to `/content/drive/MyDrive/YOLO_Sketch_Project/runs`, the model saves the `last.pt` weight matrix after every single epoch. 

> [!NOTE]
> For the complete execution reference code, see the supplementary manual: [Google Colab Resumable Training Guide](../yolo_test/colab_google_drive_resumable_training.md).

### How to Resume After Automatic Disconnection
Google Colab's free tier automatically disconnects inactive sessions or terminates runtime after approximately 4 to 5 hours. If your training session is interrupted, follow these exact steps to seamlessly resume without losing progress:

1. **Re-Open Google Colab:** Launch a new Colab notebook and ensure the runtime is set to **T4 GPU**.
2. **Mount Google Drive:** Run Block 1 from the [Training Guide](../yolo_test/colab_google_drive_resumable_training.md) to reconnect your Google Drive filesystem.
3. **Regenerate the Dataset:** Run Block 2 from the Training Guide. Because Colab completely deletes all local files (like `/content/massive_sketch_dataset`) when a session disconnects, you must re-run the 3-minute streaming script to put the dataset back onto the new server's SSD.
4. **Execute the Resumption Command:** Run Block 3 from the Training Guide. The script will automatically detect the presence of `/content/drive/MyDrive/YOLO_Sketch_Project/runs/massive_sketch_pose/weights/last.pt` and initiate `model.train(resume=True)`.

The Ultralytics optimizer will restore its saved learning rate momentum and continue precisely from the last completed epoch.
