# Project Handover & Technical Master Document: Eduvision Native Animation Engine

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
