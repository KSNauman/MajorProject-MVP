# EduVision — Sketch to Animation Pipeline

> An AI-powered system that takes children's hand-drawn sketches and animates them into story videos using YOLO pose estimation and Gemini Vision.

---

## Project Structure

```
MajorProject-MVP/
├── core_engine/          # Main animation pipeline
│   ├── 2_classify/       # Gemini Vision sketch classifier (humanoid / wheeled)
│   ├── pose/             # YOLO best.pt pose detector (17 keypoints)
│   ├── stage3_animate/   # Animation stage (humanoid skeleton / bounce)
│   ├── Test/             # Sample test images
│   └── run_pipeline.py   # Entry point — run this
│
├── story_engine/         # Story narrative generator (scene sequencer)
├── yolo_test/            # YOLO model training scripts + best.pt model
├── training_pipeline/    # Colab training notebooks
├── textbook/             # Full project documentation (10 chapters + appendices)
└── project_handover.md   # Complete project reference
```

---

## Quick Start

### 1. Clone the repo
```bash
git clone https://github.com/KSNauman/MajorProject-MVP.git
cd MajorProject-MVP
```

### 2. Install dependencies
```bash
pip install ultralytics opencv-python pillow requests python-dotenv
```

### 3. Get the trained model
The trained `best.pt` YOLO pose model is **not in the repo** (too large for GitHub).  
Ask a teammate to share `best.pt` and place it at:
```
yolo_test/best.pt
```

### 4. Set up your API key
```bash
cp core_engine/.env.example core_engine/.env
# Edit core_engine/.env and add your Gemini API key
```

### 5. Run the pipeline
```bash
cd core_engine
python run_pipeline.py "Test/humantest.png"
```

**Output saved to:** `core_engine/output/`
- `*_skeleton.png` — annotated skeleton image
- `*_keypoints.json` — normalized joint coordinates (17 joints)

---

## Pipeline Flow

```
Input Sketch
    │
    ▼
Gemini Vision (gemini-flash-latest)
    │
    ├── is_humanoid = True
    │       └── YOLO best.pt  →  17 joints detected  →  skeleton PNG + keypoints JSON
    │
    └── is_wheeled = True
            └── Bounce Animator  →  animated GIF
```

---

## Model Performance

| Metric | Result |
|:---|:---|
| Test images | 26 sketch drawings |
| Detection rate | **26/26 (100%)** |
| Average joints detected | **17/17** |
| Average confidence | **1.00** |

---

## Tech Stack

| Component | Technology |
|:---|:---|
| Pose Estimation | YOLOv8-Pose (custom trained on sketch dataset) |
| Sketch Classifier | Gemini Vision API (`gemini-flash-latest`) |
| Animation Engine | OpenCV + Pillow |
| Story Narration | Gemini text generation |
| Training Platform | Google Colab (T4 GPU) |
