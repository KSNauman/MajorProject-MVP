# Chapter 8: MediaPipe Web Pose Estimation Failure Log

**Date:** August 18, 2026  
**Status:** FAILED (Model domain mismatch on abstract drawings/sketches)

---

## 1. Experiment Overview
To find a lightweight, browser-side alternative to the backend AI models, we tested **Google's MediaPipe Pose Landmarker for Web (JavaScript)**. The objective was to determine if MediaPipe's client-side WebAssembly vision task could estimate humanoid skeletons directly on uploaded user drawings and sketches.

A dedicated local server and dashboard were constructed at [`mediapipe_web_test/`](file:///C:/MajorProject-MVP/MajorProject-MVP/mediapipe_web_test) using:
- Modern ES Module integration (`vision_bundle.mjs`)
- The high-precision **`pose_landmarker_heavy.task`** model (29.24 MB)
- Real-time HTML canvas rendering overlays matching responsive container bounds
- Live in-browser terminal log console output

---

## 2. The Failure Analysis
When evaluated against actual children's drawings and hand-drawn sketch characters (like `garlic.png`), the MediaPipe Web model failed to detect or estimate skeletons. 

Even on clean, full-body sketch drawings where joints were clearly visible, the model consistently exhibited the following behaviors:
1.  **Zero Detection (Blindness):** On abstract sketches, the model returned empty landmark lists (`results.pose_landmarks = []`).
2.  **Landmark Clumping / Shifting:** If the model did output a pose, it was completely misaligned (often clumped in a tiny distorted layout near the face/neck area), completely failing to extend to limbs.

```
       [MediaPipe Pose Model Target: Real Human Photos]
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
           [Complex Skin/Texture]    [Real Human Proportions]
                    │                   │
                    └─────────┬─────────┘
                              ▼
           [Fails on: Hand-drawn lines, no skin textures,
            abstract shapes, non-standard limbs]
```

### Root Cause Diagnosis:
*   **Domain Shift:** MediaPipe Pose is a deep learning model trained on **COCO/Real-world photography** (photographs of actual humans). The model's convolutional filters rely heavily on features like skin texture, realistic limb lighting, clothing boundaries, and standard human body proportions.
*   **Ink/Line Invariance:** Abstract sketch humanoids contain only raw contours, variable line widths, transparent bodies, and cartoonish proportions. The model's filters do not activate on these raw ink patterns, rendering the AI completely "blind" to non-photographic drawings.

---

## 3. Conclusions & Key Takeaways
1.  **Out-of-the-box general human pose estimators (like MediaPipe or standard YOLO-pose) cannot be used for children's drawings.**
2.  This experiment validates the architectural necessity of **Track A (YOLOv8-pose custom training)**: we *must* train a model from scratch on Meta's **Amateur Drawings Dataset (ADD)**, as it is the only dataset that contains the visual style and joint coordinates of abstract children's doodles.
