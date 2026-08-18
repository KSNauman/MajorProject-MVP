# AI Agent Handoff: EduVision Project
**Written by:** Agent on Windows machine  
**Written for:** Agent on Linux machine  
**Date:** August 18, 2026  
**GitHub Repo:** https://github.com/KSNauman/MajorProject-MVP

---

> **READ THIS FIRST.** This document is written agent-to-agent. Treat every word as verified ground truth. Do not re-investigate things marked as confirmed failures — they are done. Start from Section 6 (Next Steps).

---

## 1. Project Identity

**Name:** EduVision  
**Type:** AI-Powered Collaborative Story Animation for early childhood classrooms

**Core loop:**
1. Teacher writes a short story (e.g., *"The farmer walks to the barn. The dog jumps."*)
2. Children each draw one character on paper (farmer, dog, cow, etc.)
3. Teacher uploads all sketches via a web UI
4. AI detects each character's skeleton, reads the story via LLM, assigns the right motion
5. System renders each character animated and stitches the scene together
6. Class watches their drawings come alive as a shared animated story

**Tech stack (final, do not revisit):**
| Layer | Technology |
|:---|:---|
| Pose / Detection engine | Meta AnimatedDrawings (TorchServe with `.mar` models) |
| LLM (story → motion mapping) | Google Gemini API (`gemini-1.5-flash`) |
| Motion clips | BVH files (currently 5: walk, wave, dab, jumping_jacks, zombie) |
| Backend API | Python Flask |
| Frontend | React |
| Output | Animated GIF |

---

## 2. Full History of What Was Tried (Do Not Retry These)

### FAILED: Native Python pipeline (YOLOv8 + MediaPipe)
- Replaced TorchServe with YOLOv8n for detection and MediaPipe for pose
- Both trained on COCO real-photo dataset
- **Failed:** Completely blind to children's sketch domain. YOLOv8 returns 0 bounding boxes on drawings. MediaPipe throws AssertionError when no human skin detected.

### FAILED: Custom YOLOv8-pose training on Meta ADD dataset
- Downloaded Meta's Amateur Drawings Dataset (178,000 annotated drawings)
- Converted JSON to YOLO-pose format, trained on Google Colab, scaled to 11,500-image dataset
- **Failed:** YOLOv8n-pose (3M params) exhibited Mode Collapse — always outputs identical A-pose regardless of drawing.
- **Status:** Handed off to the team. They will continue with larger models. Do not touch `training_pipeline/` yourself.

### FAILED: MediaPipe Web (browser-side WebAssembly)
- Built full web sandbox at `mediapipe_web_test/` with MediaPipe Tasks Vision JS SDK
- Upgraded to `pose_landmarker_heavy.task` (29.24 MB), fixed canvas alignment, corrected joint topology
- **Failed:** Same root cause — trained on real photos, blind to sketch domain.
- Documented in `textbook/chapter8_mediapipe_web_failure.md`.

### FAILED: Google Teachable Machine
- Not viable. It is a classification wrapper on top of MediaPipe — inherits the same blindness.
- Also outputs class labels, not coordinate regressions. Cannot feed the animation engine.

---

## 3. The Correct Architecture

The Meta AnimatedDrawings repository already solves the entire sketch → animation pipeline. It uses:
- `drawn_humanoid_detector.mar` → detects and crops the character from the sketch
- `drawn_humanoid_pose_estimator.mar` → estimates 15-point skeleton on the cropped character

These are ResNet models **trained specifically on children's drawings**. They work.

The pipeline runs via **TorchServe** exposing a REST API on `localhost:8080`.

**Why it never worked on Windows:** Java 8 was installed. TorchServe requires Java 11+.

---

## 4. Repo Structure (Key Locations)

```
MajorProject-MVP/
├── Actual repo (EDUVISION)/AnimatedDrawings/   <- THE MAIN ENGINE
│   ├── examples/
│   │   ├── image_to_annotations.py             <- Entry: sketch -> skeleton JSON
│   │   ├── annotations_to_animation.py         <- Entry: skeleton JSON -> GIF
│   │   └── image_to_animation.py               <- Convenience wrapper (both steps)
│   ├── assets/bvh/                             <- BVH motion files (5 currently)
│   │   ├── walk.bvh, wave.bvh, dab.bvh
│   │   ├── jumping_jacks.bvh, zombie.bvh
│   └── animated_drawings/                      <- Rendering/physics engine (MVC)
├── textbook/                                   <- Research + engineering notes
│   ├── README.md                               <- Project idea + TOC + future advancements
│   ├── chapter7_failure_and_pivot.md           <- YOLOv8 failure log
│   └── chapter8_mediapipe_web_failure.md       <- MediaPipe failure log
├── training_pipeline/                          <- TEAM ONLY. Do not touch.
└── project_handover.md                         <- This file
```

---

## 5. The Graphics Engine (Know This)

1. `image_to_annotations.py` → calls TorchServe at `localhost:8080` → gets JSON with bounding box + 15 keypoints → saves `annotations.yaml`
2. `annotations_to_animation.py` → reads `annotations.yaml` + BVH file + config YAML → renders to GIF
3. Render pipeline: Mask → Marching Squares → Delaunay triangulation → Barycentric binding → PCA 3D→2D retargeting → ARAP physics → OpenGL → GIF

---

## 6. Next Steps (Start Here on Linux)

### Step 1 — Environment Setup
```bash
git clone https://github.com/KSNauman/MajorProject-MVP.git
cd MajorProject-MVP

# Java 17 (required for TorchServe)
sudo apt install openjdk-17-jdk
java -version  # must show 17.x.x

# Python env (use Python 3.9 or 3.10)
python3 -m venv animated_drawings_env
source animated_drawings_env/bin/activate

cd "Actual repo (EDUVISION)/AnimatedDrawings"
pip install -e .
pip install torchserve torch-model-archiver torch-workflow-archiver
```

### Step 2 — Download .mar models and start TorchServe
The `.mar` files are NOT in the repo (gitignored — large binaries).
Follow: `Actual repo (EDUVISION)/AnimatedDrawings/README.md` → "Getting Started" → "TorchServe"
The README has the exact wget commands to download the models from Meta's servers.

```bash
torchserve --start --model-store model-store/ \
  --models drawn_humanoid_detector=drawn_humanoid_detector.mar \
           drawn_humanoid_pose_estimator=drawn_humanoid_pose_estimator.mar

curl http://localhost:8080/ping  # must return {"status": "Healthy"}
```

### Step 3 — Run end-to-end test
```bash
cd examples/
python image_to_annotations.py drawings/garlic.png
# produces garlic_out/annotations.yaml

python annotations_to_animation.py garlic_out/annotations.yaml
# produces garlic_out/video.gif
```
**If this produces a GIF → the core engine is working. Everything else is product work.**

> NOTE: On headless Linux, pyglet (OpenGL) needs a virtual display:
> `xvfb-run python annotations_to_animation.py garlic_out/annotations.yaml`

### Step 4 — Expand BVH motion library
Need: run, jump, sit, clap, idle, dance
Source: https://www.mixamo.com (free with Adobe account) → Export as BVH
Place in: `Actual repo (EDUVISION)/AnimatedDrawings/assets/bvh/`

### Step 5 — Create motion_library.json
```json
{
  "walk":   { "file": "assets/bvh/walk.bvh",          "keywords": ["walk", "move", "go"] },
  "wave":   { "file": "assets/bvh/wave.bvh",          "keywords": ["wave", "hello", "greet"] },
  "dance":  { "file": "assets/bvh/dab.bvh",           "keywords": ["dance", "celebrate"] },
  "jump":   { "file": "assets/bvh/jumping_jacks.bvh", "keywords": ["jump", "leap", "hop"] },
  "zombie": { "file": "assets/bvh/zombie.bvh",        "keywords": ["zombie", "creep"] }
}
```

### Step 6 — Wire Gemini LLM (story → motion mapping)
Get free key at: https://aistudio.google.com
```python
import google.generativeai as genai, json, os
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-1.5-flash")

def map_story_to_motions(story: str, character_names: list) -> dict:
    prompt = f"""
You are a motion director for children's animation.
Story: "{story}"
Characters: {character_names}
Valid actions: ["walk", "wave", "dance", "jump", "zombie", "idle"]
Output ONLY a JSON object. No explanation.
Example: {{"farmer": "walk", "dog": "jump"}}
"""
    response = model.generate_content(prompt)
    return json.loads(response.text.strip())
```

### Step 7 — Flask API
```
POST /api/upload       - accept sketch PNG, return character ID
POST /api/animate      - accept story + character IDs, run pipeline, return GIF URL
GET  /api/result/<id>  - return generated GIF
```

### Step 8 — React frontend
Three screens: Session (upload + story) → Processing (loading) → Result (watch + download)

---

## 7. Known Gotchas

- `image_to_annotations.py` was partially modified on Windows to bypass TorchServe. **Revert it to original** (or re-clone) before using on Linux — original correctly calls `localhost:8080`.
- `animated_drawings_env/` is gitignored — recreate it fresh.
- `*.task` and `*.mar` files are gitignored — download separately.
- Python 3.9 or 3.10 recommended for torch/mediapipe compatibility.
- The team is separately training YOLOv8 in `training_pipeline/`. If they succeed, their `best.pt` can eventually replace TorchServe. Do not wait for them.


*Note to AI Assistant on the Windows machine: Treat this document as your primary context. It contains the exact architectural decisions, code changes, and mathematical concepts we established on the Linux machine before the migration.*

---

## 1. The Core Mission
We are building a scalable, native-Python alternative to Meta's `AnimatedDrawings` engine. The end goal is to integrate this as a backend service for the **Eduvision Node.js Web Application**, allowing kids to upload doodles and instantly receive animated GIFs.

**The Problem:** The original Meta repository relied on a massive, bloated Docker container running `TorchServe` to host ResNet models for detection, segmentation, and pose estimation. This was too heavy, slow, and expensive for a web backend.
**Our Solution:** We completely removed Docker and replaced the AI pipeline with modern, lightweight, native Python models.

---

## 2. Phase 1: The Native AI Pipeline Refactor
We rewrote the core logic inside `examples/image_to_annotations.py` to bypass TorchServe entirely. Here is the exact stack we implemented:

### A. Detection (Bounding Boxes)
*   **Previous:** `drawn_humanoid_detector` (Mask R-CNN / ResNet).
*   **Current:** `YOLOv8n` (`ultralytics`).
*   **Implementation:** We load `yolov8n.pt`. If YOLO detects a human, we crop it. If YOLO finds zero bounding boxes (which happens often with non-human sketches), we implemented a **fallback script** that defaults to using the entire image dimensions.

### B. Pose Estimation (The Skeleton)
*   **Previous:** `drawn_humanoid_pose_estimator` (ResNet).
*   **Current:** Google `MediaPipe Pose`.
*   **Implementation:** We used `mediapipe==0.10.10` (to avoid Python 3.8 type-hinting bugs). MediaPipe outputs a 33-point COCO keypoint skeleton. We wrote a custom mapping dictionary to convert those 33 points into the exact **16-point skeleton** required by the downstream ARAP engine.

### C. Segmentation (The Mask)
*   **Previous:** Brittle OpenCV thresholding and morphological flood-fill operations.
*   **Current:** `rembg` (U2-Net).
*   **Implementation:** Because `rembg` is a Salient Object Detector, it flawlessly segments foreground sketches (like a drawn garlic bulb) without needing to recognize it as a human. It perfectly generates the required `mask.png`.

---

## 3. Phase 2: The Graphics Engine Architecture (MVC)
We deeply analyzed the rendering engine (`animated_drawings/render.py`). It is built on a strict **Model-View-Controller (MVC)** architecture.

*   **The Controller (The Director):** Located in `video_render_controller.py`. It runs a 30 FPS infinite loop. It tells the Model to calculate the math for Frame 1, tells the View to draw Frame 1, and then uses OpenGL `glReadPixels` to scrape the GPU framebuffer and save it to a `.gif` or `.mp4`.
*   **The View (The Camera):** Located in `view.py`. It uses OpenGL (`pyglet`) to paint the `texture.png` onto the screen.
*   **The Model (The Puppeteer & Physics):** Located in `animated_drawing.py`. It handles the hardcore physics.
    1.  **Marching Squares & Triangulation:** It traces the `mask.png` and uses `scipy.spatial.Delaunay` to build a triangle mesh over the character.
    2.  **Barycentric Coordinates:** It runs a Breadth-First Search (BFS) to map every triangle to the closest bone. Because joints rarely land perfectly on triangle vertices, it uses Barycentric weights to bind joints to the *inside* of triangles.
    3.  **PCA Retargeting (`retargeter.py`):** To prevent 3D Mixamo `.bvh` animations from crushing the 2D mesh due to foreshortening (e.g., an arm pointing at the camera), the engine runs Principal Component Analysis. It finds the 3rd Principal Component (the normal of the plane with the least variance) and orthogonally flattens the 3D motion onto that plane.
    4.  **ARAP (`arap.py`):** The As-Rigid-As-Possible solver. As the skeleton moves, ARAP minimizes the distortion of every triangle, resulting in rubber-like bending at the joints while keeping forearms/shins rigid.

---

## 4. The Critical Blocker: The AI is Blind to Sketches
While our native pipeline works flawlessly, **we hit a mathematical wall**: YOLOv8 and MediaPipe are trained on the COCO Dataset (photos of real humans). When we fed it a drawing of a garlic with stick-figure legs (`garlic.png`), YOLO returned 0 bounding boxes and MediaPipe threw an `AssertionError` because it couldn't find human skin.

---

## 5. Next Steps for the Windows Machine (The Roboflow Strategy)
To fix the blocker, we must adopt a **"Hybrid Approach"**. We will keep `rembg` for the segmentation masks, but we will train a custom AI specifically for sketches.

**The Action Plan:**
1.  **Download the Data:** Write a Python script to download Meta's **"Amateur Drawings Dataset" (ADD)**, which contains 178,000 human-annotated children's drawings with bounding boxes and 16-point skeletons.
2.  **Dataset Translation:** Write a script to translate Meta's custom JSON annotations into the exact COCO-Keypoint format required by Roboflow/YOLO.
3.  **Upload to Roboflow:** Create a **Keypoint Detection (Pose)** project on Roboflow and upload the translated dataset via the Roboflow API.
4.  **Train a YOLOv8-Pose Model:** Click Train on Roboflow (or run it locally on Google Colab). A YOLO-Pose model outputs *both* Bounding Boxes and Keypoints simultaneously!
5.  **Integration:** Download the resulting `best.pt` file, drop it into `image_to_annotations.py`, completely replace MediaPipe, and integrate the final flawless engine into the Eduvision Node.js backend.

---

## 6. Phase 3: The Deep Learning Failure & Pivot to TorchServe
*Log Entry: July 2026*

We executed the Roboflow Strategy (Phase 2), eventually scaling to an 11,500-image dataset streamed directly from Meta's CDN into Google Colab. 
However, after multi-day training runs, the custom YOLOv8n-pose models consistently exhibited **Mode Collapse** on highly abstract or thick-line drawings (regressing to an identical A-pose template bounding the entire image). 

**Diagnosis:**
1. Small models (`yolov8n-pose.pt`, ~3M parameters) lacked the capacity to learn visual joint features from the extreme variance of children's sketches.
2. The extreme abstraction of the sketches resulted in a loss landscape where outputting the statistical mean (A-pose) yielded lower loss than attempting to track the chaotic ink.

**The Pivot:**
We are abandoning the custom YOLOv8 native pipeline. We will revert to the original `drawn_humanoid_detector.mar` and `drawn_humanoid_pose_estimator.mar` models provided by the Meta AnimatedDrawings repository. Because the Eduvision backend runs on Windows and we need to avoid Docker overhead, our new objective is to configure and run **TorchServe natively on Windows** to host these `.mar` models.
