# YOLOv8-Pose Sketch Model Training Guide

This guide details how to train your custom **YOLOv8-Pose** sketch model using either **Roboflow** (GUI-based, cloud hosting) or **Google Colab** (Free GPU cloud notebooks).

Training is based on the small subset of **1,200 drawings** extracted from Meta's Amateur Drawings Dataset.

---

## 1. Preparing the Dataset Zip

Before proceeding with either method, you need to zip the generated dataset:

1. Locate the dataset directory:
   `c:\MajorProject-MVP\MajorProject-MVP\yolo_test\sketch_yolo_dataset`
2. Compress this folder into a `.zip` archive (e.g., `sketch_yolo_dataset.zip`).
   - The zip should contain:
     - `images/train/` (1000 images)
     - `images/val/` (200 images)
     - `labels/train/` (1000 TXT annotation files)
     - `labels/val/` (200 TXT annotation files)
     - `sketch_pose_dataset.yaml`

---

## 2. Option A: Training with Roboflow (GUI Method)

Roboflow is a web-based dataset management and training platform. It handles custom keypoint rendering and training out of the box.

### Step 1: Create a Roboflow Project
1. Go to [Roboflow](https://roboflow.com/) and create a free account.
2. Click **Create New Project**.
3. Select project settings:
   - **Project Type:** `Keypoint Detection (Pose)`
   - **What are you detecting?** `Sketch Character` / `Humanoid`

### Step 2: Define Keypoints & Skeleton
1. When prompted, add the **17 keypoints** in the exact COCO order:
   ```txt
   nose, left_eye, right_eye, left_ear, right_ear, left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist, right_wrist, left_hip, right_hip, left_knee, right_knee, left_ankle, right_ankle
   ```
2. Define the skeleton connections (e.g., connect left_shoulder to left_elbow, left_elbow to left_wrist, etc.) to visualize the joints.

### Step 3: Upload the Dataset (GUI or CLI)

Choose **one** of the following methods to upload your dataset:

#### Method 1: Web GUI (Drag & Drop)
1. Drag and drop your `sketch_yolo_dataset.zip` into the Roboflow upload web page.
2. Roboflow will automatically detect the YOLOv8 TXT format, parse the keypoint annotations, and show you previews of the sketches with skeletal overlays!
3. Click **Save and Continue** to upload.

#### Method 2: Roboflow CLI
If you prefer using the command line:
1. Install the Roboflow library:
   ```bash
   pip install roboflow
   ```
2. Authenticate the CLI (this will open a browser tab to log in):
   ```bash
   roboflow auth login
   ```
3. Upload the dataset folder directly (replace `YOUR_PROJECT_ID` with the ID from your browser URL):
   ```bash
   roboflow image upload c:\MajorProject-MVP\MajorProject-MVP\yolo_test\sketch_yolo_dataset -p YOUR_PROJECT_ID
   ```
   *(The CLI will scan the directories, pair the images with their labels, and perform the upload in parallel.)*

### Step 4: Generate Version & Train
1. Go to the **Generate** tab.
2. Keep the default settings (no augmentations needed for the initial test) and click **Generate**.
3. Once the version is created, click **Train Model**.
4. Choose **YOLOv8** -> **YOLOv8n-pose** -> Click **Start Training** (using Roboflow's free cloud training credit).

### Step 5: Export Weights
1. Once training completes, go to the **Deploy** tab.
2. Download the resulting weights file (`best.pt`).
3. Rename it to `sketch_yolov8_pose.pt` and place it in:
   `c:\MajorProject-MVP\MajorProject-MVP\yolo_test\sketch_yolov8_pose.pt`

---

## 3. Option B: Training with Google Colab (Free GPU Method)

Google Colab provides a free cloud environment with NVIDIA T4 GPUs, ideal for training YOLOv8 models.

### Step 1: Open a new Google Colab Notebook
1. Go to [Google Colab](https://colab.research.google.com/).
2. Create a new notebook.
3. Change the runtime type to GPU:
   - **Runtime** -> **Change runtime type** -> select **T4 GPU** -> click **Save**.

### Step 2: Upload the Dataset to Colab
1. In the left-hand panel of Colab, click the **Files** folder icon.
2. Drag and drop the corrected dataset ZIP file from your PC directly into the files list:
   `c:\MajorProject-MVP\MajorProject-MVP\yolo_test\sketch_yolo_corrected.zip`
3. Wait for the upload circle at the bottom-left to complete.

### Step 3: Extract the Dataset
Run this in a cell to extract the dataset:

```python
!unzip -q sketch_yolo_corrected.zip -d sketch_yolo_corrected
```

### Step 4: Install Ultralytics & Train
Run this code to install YOLO and train the model for 50 epochs:

```python
# 1. Install ultralytics
!pip install ultralytics

# 2. Train the model
from ultralytics import YOLO

# Load the base COCO pre-trained pose model
model = YOLO('yolov8n-pose.pt')

# Train on our custom sketches
model.train(
    data='sketch_yolo_corrected/sketch_yolo_corrected/data.yaml',
    epochs=50,
    imgsz=640,
    batch=16,
    device=0  # GPU
)
```

*(This will run very quickly on Colab's T4 GPU, completing in about 10–12 minutes.)*

### Step 5: Download Weights
Once training finishes, zip and download the trained `best.pt` file:

```python
# 1. Zip the output
!zip -r sketch_weights.zip runs/pose/train/weights/best.pt

# 2. Download the zip
from google.colab import files
files.download('sketch_weights.zip')
```

Once downloaded:
1. Extract the `best.pt` file from `sketch_weights.zip`.
2. Rename it to **`sketch_yolov8_pose.pt`**.
3. Place it in your local folder:
   `c:\MajorProject-MVP\MajorProject-MVP\yolo_test\sketch_yolov8_pose.pt`

