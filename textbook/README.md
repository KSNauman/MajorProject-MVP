# EduVision: AI-Powered Collaborative Story Animation

> **A classroom tool where children draw characters on paper, and AI brings their entire class story to life.**

---

## 🎯 Project Idea

**EduVision** is a collaborative story animation platform designed for early childhood classrooms.

### The Flow
1. **Teacher** creates a story session and writes a short story description  
   *(e.g., "The farmer walks to the barn. The dog jumps around.")*
2. **Kids** each draw one character on paper — a farmer, a cow, a dog, a tree
3. **Teacher uploads** all the sketches into the platform
4. **AI detects** each character's skeleton, reads the story, and assigns the right motion to each drawing
5. **System renders** each character animated — farmer walks, dog jumps, cow stands idle
6. **Class watches** their drawings come alive together as a shared story

### Why it matters
- Every child contributes — no one is a passive viewer
- First tool to animate a **collaborative, multi-character scene** from kids' own drawings
- No artistic skill required from the teacher — just upload and describe
- Real AI driving real animation, not templates

---

## 🏗️ System Architecture

```
Teacher types story + uploads sketches
              │
              ▼
  ┌────────────────────────────────────────────┐
  │           Python Flask Backend             │
  │                                            │
  │  ┌────────────────┐  ┌──────────────────┐  │
  │  │  TorchServe    │  │  Gemini LLM API  │  │
  │  │ (Meta Models)  │  │ (Story→Motion)   │  │
  │  │ detect pose on │  │ "farmer" → walk  │  │
  │  │ each sketch PNG│  │ "dog"    → jump  │  │
  │  └───────┬────────┘  └────────┬─────────┘  │
  │          │ skeleton JSON      │ BVH file    │
  │          └──────────┬─────────┘            │
  │                     ▼                       │
  │          ┌──────────────────────┐           │
  │          │ AnimatedDrawings     │           │
  │          │ Render Engine        │           │
  │          │ (ARAP + OpenGL)      │           │
  │          └──────────┬───────────┘           │
  └─────────────────────┼─────────────────────-─┘
                        │ animated GIFs
                        ▼
            Scene stitched → shown in browser
```

---

## 📖 Research & Engineering Textbook

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

### [Chapter 7: Deep Learning Failure & Architecture Pivot ❌](chapter7_failure_and_pivot.md)
* Log of YOLOv8n-pose failure (mode collapse) and the decision to pivot to Meta's engine.

### [Chapter 8: MediaPipe Web Pose Estimation Failure Log ❌](chapter8_mediapipe_web_failure.md)
* Log of Google MediaPipe WebAssembly landmarker failure on sketch-domain images.

### [Chapter 9: Multi-Scene Story Engine & BVH Import ✅](chapter9_story_engine.md)
* Automated storytelling pipeline using MoviePy and Google TTS (gTTS).
* Details on how to download, configure, and seamlessly retarget custom Mixamo BVH motion files into the rendering engine.

---

## 🚀 Future Advancements

Potential directions beyond the current MVP — for future versions or research extensions.

| Idea | Description |
|:---|:---|
| **Custom Sketch Pose Model** | Train YOLOv8m-pose on Meta's Amateur Drawings Dataset to replace TorchServe with a lightweight model that runs entirely in-browser |
| **Auto Story Generation** | LLM generates the full story from just a theme word (e.g., "farm") — no teacher input needed |
| **Non-Humanoid Animation** | Extend to animate animals, vehicles, and objects using quadruped or custom skeleton rigs |
| **Real-Time Drawing Mode** | Draw directly in-browser on a tablet — character animates live as the sketch is completed |
| **Voice Narration (DONE ✅)** | TTS narration plays over the animated scene, reading the story aloud while characters move |
| **Multi-Scene Sequencing (DONE ✅)** | Teachers build a multi-scene storyboard — characters move across different backgrounds |
| **Student Portfolio** | Each child's animated character is saved to a personal gallery accessible by parents |

---

*Last updated: August 27, 2026*
