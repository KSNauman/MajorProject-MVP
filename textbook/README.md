# EduVision: Turning Children's Drawings into Animations

> **A classroom platform where a child's own drawing is found by AI, rigged with a skeleton, and animated in stories and learning games, entirely on the school's own computer.**

This textbook records the mathematics, theory, experiments (including the failures) and engineering lessons behind EduVision, in the order they happened. Some early chapters describe plans or tools that were later replaced; each such chapter now carries a note at the top saying what changed.

For the **current** system, start with the project documentation in [`docs/project/`](../docs/project/00_INDEX.md).

---

## What EduVision Does (as built, November 2026)

1. A child draws a person on paper, and the teacher or child uploads a photo of it.
2. A **custom YOLOv8-Pose model** (`best.pt`, trained on Meta's Amateur Drawings dataset) finds the figure and 17 body keypoints.
3. A **hybrid mask** (rembg's U²-Net plus OpenCV pen-line detection) cuts the figure out.
4. In the **Fixer**, a teacher can drag joints, erase stray marks or draw a missing limb.
5. Meta's **AnimatedDrawings** engine builds a mesh and moves it with motion-capture data using **ARAP** deformation.
6. The animated characters are placed into the 9-scene story **"Rahim's Family"** with a recorded narration, and reused as rewards in **six learning games**.
7. A **classroom platform** connects admins, teachers, parents and students: avatar login for children, assignments, scores and story videos.

**No generative-AI service or API key is used.** The original plan included Google's Gemini API (to pick motions from a typed story) and Meta's TorchServe models. Both were dropped: the Gemini API's terms forbid services likely to be used by people under 18, children's drawings should not leave the school, and TorchServe needed Docker and Java. The reasons, with evidence, are in [docs/project/04_WHY_NO_GENERATIVE_AI_APIS.md](../docs/project/04_WHY_NO_GENERATIVE_AI_APIS.md).

## System Architecture (as built)

```text
Browser (child, teacher, parent, admin)
   │
   ▼
Portal :5173 ──REST + signed tokens──► Platform API :4000 ──► PostgreSQL
   │ launch token                         ▲ scores and story videos
   ├──► Activity Center :5000 ────────────┤  (six games)
   │        └─ /api/animate-drawing ─► animate_drawing_service.py
   └──► Story Studio :3001 ─► Story Engine :3000 ─► Python jobs:
                                 prepare_character_api.py  (best.pt + rembg)
                                 batch_animate.py          (AnimatedDrawings, ARAP)
                                 compose_story.py          (FFmpeg, one pass)
                                         │
                                         ▼
                           AI Server :5001 keeps the models loaded
```

---

## Chapters

### [Chapter 1: Deep Learning Pose Estimation (YOLOv8-Pose)](chapter1_yolo_pose.md)
* How convolutional networks detect objects and regress joint keypoints in a single forward pass.
* Covers: CSPDarknet backbones, PANet necks, anchor-free heads, OKS loss.

### [Chapter 2: The Dataset and Coordinate System Alignment](chapter2_data_coordinates.md)
* The coordinate math needed to map dataset labels to downscaled and cropped images.
* Covers: pixel coordinate space, original vs. cropped dimensions, scale-matching equations.

### [Chapter 3: Deep Learning Training and Performance Mechanics](chapter3_training_mechanics.md)
* How cloud GPUs train neural networks and how to read training performance.
* Covers: transfer learning, dataset splits, learning rates, mAP50.

### [Chapter 4: 2D Graphics Geometry and Physics Deformations](chapter4_graphics_rendering.md)
* How a static 2D drawing becomes a moving 2D mesh controlled by a skeleton.
* Covers: marching squares, Delaunay triangulation, barycentric coordinates, ARAP.

### [Chapter 5: Google Colab Training Workflow](chapter5_colab_workflow.md)
* Step-by-step cloud workflow for training the custom YOLO pose model.

### [Chapter 6: Cloud Scaling and Spatial Padding](chapter6_cloud_scaling.md)
* How padding augmentation resolved the model's "same A-pose for every drawing" mode collapse.

### [Chapter 7: A Failed Training Run and a Temporary Pivot](chapter7_failure_and_pivot.md)
* Log of the YOLOv8n-pose mode collapse and the temporary switch to Meta's TorchServe models. *Later superseded:* the retrained `best.pt` was integrated on 16 September 2026 and TorchServe was removed.

### [Chapter 8: MediaPipe Web Pose Estimation Failure Log](chapter8_mediapipe_web_failure.md)
* Why Google MediaPipe's photo-trained pose model fails on drawings (evidence for building a custom model).

### [Chapter 9: Multi-Scene Story Engine and BVH Import](chapter9_story_engine.md)
* The first story engine and how to add Mixamo BVH motions. *Later superseded:* its MoviePy and gTTS video builder was replaced by `compose_story.py` (see the note at the top of the chapter).

### [Chapter 10: Performance Metrics](chapter10_performance_metrics.md) and [GPU Integration](Chapter10_GPU_Integration.md)
* Removing TorchServe, running the models on the GPU, and the first persistent AI server.

### [Chapter 11: Developer Guide](chapter11_developer_guide.md)
* How the code is organised and how to work on it.

### [Chapter 12: Engine Optimization and Sealing](chapter12_engine_optimization.md)
* Caching the ARAP factorisation and other engine speed-ups.

### [Chapter 13: Platform Foundation](chapter13_platform_foundation.md)
* Database, integrations, student portal, logging and playground UI (phases 2 to 11).

### [Chapter 14: The Speed Journey, From 12 Minutes to 50 Seconds](chapter14_speed_journey.md)
* Measured stages of speeding up uploads and story building, including the experiments that were rejected.

### [Chapter 15: Repository Cleanup](chapter15_repository_cleanup.md)
* Every file removed from the repository, why, and how to restore it.

### [Audit Report](EduVision_Audit_Report.md)
* An earlier audit of the project (a snapshot from its date; some findings have since been fixed).

---

## Future Advancements

| Idea | Status |
|:---|:---|
| **Custom sketch pose model** | **Done:** `best.pt` (YOLOv8n-pose) replaced TorchServe; it runs locally, not in the browser |
| **Voice narration** | **Done**, with a recorded narration file (the first version used the online gTTS service and was replaced) |
| **Multi-scene sequencing** | **Done:** 9 scenes, frames locked to the narration |
| **Student portfolio** | **Done:** saved story videos visible to the child, the teacher and linked parents |
| **Auto story generation** | Future, and only as a teacher-only feature with no child data, because the API terms exclude under-18 users ([docs/project/04 §4.8](../docs/project/04_WHY_NO_GENERATIVE_AI_APIS.md)) |
| **Non-humanoid animation** | Future: animals, vehicles and "tadpole" figures need other skeletons |
| **Real-time drawing mode** | Future: draw in the browser and see it animate |

The full, prioritised list is in [docs/project/06_ADVANTAGES_LIMITATIONS_FUTURE.md](../docs/project/06_ADVANTAGES_LIMITATIONS_FUTURE.md).

---

## How to Run (One-Click Launcher)

1. Make sure the PostgreSQL service (`postgresql-x64-18`) is installed and `platform/api/.env` has `DATABASE_URL` and a `JWT_SECRET`.
2. Double-click `start-eduvision.bat` (run it as Administrator if PostgreSQL needs starting). It runs pre-flight checks, frees the ports and opens six windows: Platform API (4000), Portal (5173), Story Engine (3000), Story Studio (3001), Activity Center (5000) and AI Server (5001). Then it opens `http://localhost:5173`.
3. Wait until the **EduVision-AIServer** window says it is ready (20 to 40 s) before uploading drawings.
4. To stop everything, double-click `stop-eduvision.bat`.

---

*Last updated: October 10, 2026*
- [Chapter 12: Engine Optimization and Sealing](chapter12_engine_optimization.md)
- [Chapter 13: Phase 2 to 11 - Platform Foundation, DB Setup, Integrations, Student Portal Redesign, Logging & Playground UI](chapter13_platform_foundation.md)
- [Chapter 14: The Speed Journey - From 12 Minutes to 50 Seconds](chapter14_speed_journey.md)
- [Chapter 15: Repository Cleanup](chapter15_repository_cleanup.md)
