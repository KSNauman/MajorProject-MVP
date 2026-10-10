# EduVision: AI-Powered Collaborative Story Animation

> **A classroom tool where children draw characters on paper, and AI brings their entire class story to life.**

---

## ðŸŽ¯ Project Idea

**EduVision** is a collaborative story animation platform designed for early childhood classrooms.

### The Flow
1. **Teacher** creates a story session and writes a short story description  
   *(e.g., "The farmer walks to the barn. The dog jumps around.")*
2. **Kids** each draw one character on paper â€” a farmer, a cow, a dog, a tree
3. **Teacher uploads** all the sketches into the platform
4. **AI detects** each character's skeleton, reads the story, and assigns the right motion to each drawing
5. **System renders** each character animated â€” farmer walks, dog jumps, cow stands idle
6. **Class watches** their drawings come alive together as a shared story

### Why it matters
- Every child contributes â€” no one is a passive viewer
- First tool to animate a **collaborative, multi-character scene** from kids' own drawings
- No artistic skill required from the teacher â€” just upload and describe
- Real AI driving real animation, not templates

---

## ðŸ—ï¸ System Architecture

```
Teacher types story + uploads sketches
              â”‚
              â–¼
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚           Python Flask Backend             â”‚
  â”‚                                            â”‚
  â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
  â”‚  â”‚  TorchServe    â”‚  â”‚  Gemini LLM API  â”‚  â”‚
  â”‚  â”‚ (Meta Models)  â”‚  â”‚ (Storyâ†’Motion)   â”‚  â”‚
  â”‚  â”‚ detect pose on â”‚  â”‚ "farmer" â†’ walk  â”‚  â”‚
  â”‚  â”‚ each sketch PNGâ”‚  â”‚ "dog"    â†’ jump  â”‚  â”‚
  â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
  â”‚          â”‚ skeleton JSON      â”‚ BVH file    â”‚
  â”‚          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
  â”‚                     â–¼                       â”‚
  â”‚          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
  â”‚          â”‚ AnimatedDrawings     â”‚           â”‚
  â”‚          â”‚ Render Engine        â”‚           â”‚
  â”‚          â”‚ (ARAP + OpenGL)      â”‚           â”‚
  â”‚          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€-â”€â”˜
                        â”‚ animated GIFs
                        â–¼
            Scene stitched â†’ shown in browser
```

---

## ðŸ“– Research & Engineering Textbook

This textbook documents all the math, theory, experiments (including failures), and technical learnings behind building EduVision.

### [Chapter 1: Deep Learning Pose Estimation (YOLOv8-Pose)](chapter1_yolo_pose.md)
* How convolutional networks detect objects and regress joint keypoints in a single forward pass.
* Covers: CSPDarknet backbones, PANet necks, anchor-free heads, OKS loss.

### [Chapter 2: The Dataset & Coordinate System Alignment](chapter2_data_coordinates.md)
* The coordinate math required to map dataset labels to downscaled and cropped images.
* Covers: Pixel coordinate space, original vs. cropped dimensions, scale matching equations.

### [Chapter 3: Deep Learning Training & Performance Mechanics](chapter3_training_mechanics.md)
* How cloud GPUs train neural networks and how to evaluate training performance.
* Covers: Transfer learning, T4 GPU, dataset splits, learning rates, mAP50.

### [Chapter 4: 2D Graphics Geometry & Physics Deformations](chapter4_graphics_rendering.md)
* How a static 2D drawing becomes a moving 2D mesh controlled by a skeleton.
* Covers: Marching Squares, Delaunay Triangulation, Barycentric coordinates, ARAP physics.

### [Chapter 5: Google Colab Training Workflow](chapter5_colab_workflow.md)
* Step-by-step cloud workflow for training custom YOLO pose models.
* Covers: GPU provisioning, ZIP upload, Ultralytics setup, training logs.

### [Chapter 6: Massive Cloud Scaling & Spatial Padding](chapter6_cloud_scaling.md)
* How to resolve neural network mode collapse using spatial padding augmentation.
* Covers: Overfitting diagnosis, canvas embedding math, Meta CDN streaming.

### [Chapter 7: Deep Learning Failure & Architecture Pivot âŒ](chapter7_failure_and_pivot.md)
* Log of YOLOv8n-pose failure (mode collapse) and the decision to pivot to Meta's engine.

### [Chapter 8: MediaPipe Web Pose Estimation Failure Log âŒ](chapter8_mediapipe_web_failure.md)
* Log of Google MediaPipe WebAssembly landmarker failure on sketch-domain images.

### [Chapter 9: Multi-Scene Story Engine & BVH Import âœ…](chapter9_story_engine.md)
* Automated storytelling pipeline using MoviePy and Google TTS (gTTS).
* Details on how to download, configure, and seamlessly retarget custom Mixamo BVH motion files into the rendering engine.

---

## ðŸš€ Future Advancements

Potential directions beyond the current MVP â€” for future versions or research extensions.

| Idea | Description |
|:---|:---|
| **Custom Sketch Pose Model** | Train YOLOv8m-pose on Meta's Amateur Drawings Dataset to replace TorchServe with a lightweight model that runs entirely in-browser |
| **Auto Story Generation** | LLM generates the full story from just a theme word (e.g., "farm") â€” no teacher input needed |
| **Non-Humanoid Animation** | Extend to animate animals, vehicles, and objects using quadruped or custom skeleton rigs |
| **Real-Time Drawing Mode** | Draw directly in-browser on a tablet â€” character animates live as the sketch is completed |
| **Voice Narration (DONE âœ…)** | TTS narration plays over the animated scene, reading the story aloud while characters move |
| **Multi-Scene Sequencing (DONE âœ…)** | Teachers build a multi-scene storyboard â€” characters move across different backgrounds |
| **Student Portfolio** | Each child's animated character is saved to a personal gallery accessible by parents |

---

## â–¶ï¸  How to Run (One-Click Launcher)

To simplify the entire environment startup, you can use the provided Windows batch scripts.

1. Ensure the PostgreSQL `postgresql-x64-18` service is installed.
2. Double-click `start-eduvision.bat` (or run it as Administrator if PostgreSQL is stopped and needs to be started).
   - This script automatically performs pre-flight checks, prevents duplicate instances, starts the Express API, starts the React Portal, and starts the Story Studio interface in separate visible terminal windows.
   - It will automatically launch `http://localhost:5173` in your default browser.
3. To safely stop all services started by the launcher, double-click `stop-eduvision.bat`.

*Note: The Math Blaster sample application does not have an automated start command and must be started manually if required.*

---

*Last updated: October 10, 2026*
- [Chapter 12: Engine Optimization and Sealing](chapter12_engine_optimization.md)
- [Chapter 13: Phase 2 to 10 - Platform Foundation, DB Setup, Integrations, Student Portal Redesign & Platform Logging](chapter13_platform_foundation.md)

