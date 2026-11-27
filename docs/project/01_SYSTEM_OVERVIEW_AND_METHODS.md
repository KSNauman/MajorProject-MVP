# 1. System Overview: What Was Built and How

This document describes every part of EduVision as it stands on 27 November 2026: what each part does, how it was built, which file holds it, and why it was built that way. It is the "how we did it" reference; the mathematics is in [02](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md) and the measurements are in [03](03_MODEL_METRICS.md).

---

## 1.1 The Problem and the Idea

Kindergarten children (about 3 to 6 years old) express ideas by drawing long before they can read or type. A drawing on paper does not move or talk back, so its educational use stops on the page.

**EduVision's idea:** take a photo of the child's own drawing, find the figure and its joints with AI, and make **that exact drawing** walk, wave and jump. Then reuse those moving characters across stories and learning games, inside a simple classroom platform for teachers, parents and an admin.

---

## 1.2 The Running System

`start-eduvision.bat` checks Node.js and npm, starts the PostgreSQL service, frees the ports, and opens **six processes**:

| Process | Port | Technology | Role |
|---|---|---|---|
| Platform API | 4000 | Node.js, Express 5, Prisma 5, PostgreSQL | Accounts, roles, classes, assignments, results, stories, launch tokens |
| Portal | 5173 | React 19, Vite | Admin, Teacher, Parent and Student dashboards in one web app |
| Activity Center | 5000 | Node.js, Express 4, plain HTML/JS | Six learning games ([05_ACTIVITY_CENTER.md](05_ACTIVITY_CENTER.md)) |
| Story Studio | 3001 | Node.js, Express 4 | The student-facing story page; forwards `/api` and `/uploads` to the engine |
| Story Engine | 3000 | Node.js, Express 5, multer | Receives drawings, runs Python jobs, serves videos |
| AI Server | 5001 | Python, Flask | Keeps the pose model, rembg and the animation engine loaded; one request at a time |

`stop-eduvision.bat` stops them all.

```text
 Browser (child / teacher / parent / admin)
        │
        ▼
 Portal :5173 ──REST + JWT──► Platform API :4000 ──Prisma──► PostgreSQL
        │ launch token                       ▲
        ├──────────► Activity Center :5000 ──┤ results (token)
        │                 │ /api/animate-drawing ─► animate_drawing_service.py
        └──────────► Story Studio :3001 ─proxy─► Story Engine :3000
                                                     │ spawns Python
                                                     ▼
                       prepare_character_api / batch_animate / compose_story
                                                     │ (if running)
                                                     ▼
                                     AI Server :5001 (models kept loaded)
```

---

## 1.3 Stage 1: Finding the Figure and Its Joints (custom YOLOv8-Pose)

**File:** `Actual repo (EDUVISION)/AnimatedDrawings/examples/image_to_annotations.py`. **Model:** `best.pt`.

**Why a custom model.** Pose models trained on photos of people fail on children's drawings, which have huge heads, stick limbs and missing parts. This was tested and documented:
- MediaPipe's web pose model failed (textbook chapter 8).
- Meta's original detector needed Docker, TorchServe and Java, which would not run on the team's Windows laptops (chapter 7).

**How it was trained** (chapters 2, 3, 5, 6):
1. **Data:** Meta's Amateur Drawings dataset. Its labels were in a different coordinate frame from the image files, and chapter 2 explains the conversion we derived. Labels were written in YOLO pose format: box plus 17 COCO keypoints.
2. **Base:** `yolov8n-pose.pt`, pre-trained on COCO people, then fine-tuned (transfer learning).
3. **Problem:** the first model predicted the same "A-pose" for every drawing (mode collapse, chapter 6).
4. **Fix:** **padding augmentation**. Drawings were shrunk and pasted at random places on a larger canvas, so the model had to look for the figure. Why this works is shown in [02 §2.3](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md).
5. **Training:** Google Colab GPU, 640 px images, batch 16, seed 42, 96 epochs in about 1.1 hours. All settings are in [03 §3.1](03_MODEL_METRICS.md).

**How it runs:**
1. Read the image. Transparent areas (from Fixer erasing) are placed on white. Images larger than 1000 px are scaled down.
2. Run `best.pt` on the GPU if there is one, otherwise the CPU. Take the most confident box. If no figure is found, use the whole image.
3. If the teacher fixed joints in the Fixer, those joints win, and the box grows to include them.
4. Crop, segment (Stage 2), then run the model again **on the crop** for sharper keypoints. If that finds nothing, convert the first keypoints into crop coordinates.
5. Convert 17 COCO keypoints into AnimatedDrawings' 16-joint skeleton ([02 §2.1](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)).
6. Write `texture.png`, `mask.png`, `char_cfg.yaml`, `bounding_box.yaml` and `joint_overlay.png` (for checking).

---

## 1.4 Stage 2: Cutting Out the Figure (hybrid segmentation)

**Function:** `segment()` in the same file. Full mathematics in [02 §2.4](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md).

1. **AI silhouette:** rembg's U²-Net model (`u2net`) gives a soft "this is the subject" mask.
2. **Pen lines:** adaptive Gaussian threshold (115 px window, C = 8) on the darkest colour channel, then two closings and two dilations.
3. **Intersection:** keep pixels that are both ink and subject, which removes paper texture and shadows.
4. **Thin-drawing rescue (added November 2026):** if rembg kept under 90% of the pen strokes (common for stick figures, where rembg sees only the head), add back every whole stroke it touched. A border band is ignored so the edge of the paper does not count.
5. **Clean-up:** remove regions touching the border, keep the largest outline, and fill holes.

**Why hybrid:** rembg alone gives a smooth blob that loses thin limbs and inner lines; the threshold alone keeps every pencil mark and shadow. The intersection keeps the strengths of both.

---

## 1.5 Stage 3: The Fixer (human correction)

**Files:** `platform/student-story-studio/public/fixer.html` (also in `eduvision_ui/public/`), built with **Fabric.js** on an HTML5 canvas.

1. The drawing is uploaded to `POST /api/fixer/extract`, which runs `robust_extract_api.py` → Stage 1.
2. The 17 keypoints are drawn as **draggable circles** joined by lines.
3. The teacher (or child) can:
   - **drag joints** to the right place;
   - use the **eraser** to remove stray marks;
   - use the **brush** (`PencilBrush`) to **draw a missing arm or leg**;
   - zoom in.
4. **Save** sends the edited image and the joint positions to `POST /api/fixer/save`. The engine re-runs preparation **using the hand-placed joints** (they override the model's), then animates.

**Why it matters:** about 1 in 8 real uploads had no figure detected, and a confident keypoint is not always a correct one ([03 §3.2](03_MODEL_METRICS.md)). A child's drawing cannot be guaranteed to be machine-readable, so a human must be able to fix it in seconds.

---

## 1.6 Stage 4: Animation (AnimatedDrawings, retargeting and ARAP)

**Files:** `story_engine/batch_animate.py`, and the engine in `Actual repo (EDUVISION)/AnimatedDrawings/animated_drawings/`.

1. **Mesh:** trace the mask outline, add a 40 × 40 grid of inside points, triangulate (Delaunay), and keep triangles inside the outline ([02 §2.5](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)).
2. **Pins:** each of the 16 joints is attached to the mesh using barycentric coordinates (§2.6).
3. **Motion:** a BVH motion-capture file. Its 3D bones are projected to 2D, either frontally or by a PCA rule (§2.8), and each drawn bone takes the motion bone's angle while keeping its own length.
4. **Deformation:** ARAP moves the mesh so it follows the pins while staying as rigid as possible (§2.7). The sparse system is factorised **once** per character, so each frame is cheap.
5. **Render:** OpenGL draws the textured mesh frame by frame into a transparent GIF.

**Motions available:**

| Motion | File | Source |
|---|---|---|
| idle | `idel.bvh` | Mixamo |
| wave | `wave_hello.bvh` | FAIR |
| jump | `jump.bvh` | Mixamo |
| sleep | `sleep.bvh` | Mixamo |
| opening | `opening.bvh` | Mixamo |
| walk in circle | `walk in circle.bvh` | Mixamo |

`prepare_bvh()` detects Mixamo files (joint names start with `mixamorig:`), strips the prefix, and picks the matching retarget config, ground joint and scale.

**Our changes to the original AnimatedDrawings code:**

| Change | Where | Why | Effect |
|---|---|---|---|
| Replaced TorchServe detector and pose models with `best.pt` | `image_to_annotations.py` | No Docker/Java on Windows; children's drawings | Runs natively |
| Hybrid segmentation and thin-drawing rescue | `segment()` | Better masks for line drawings | §1.4 |
| Cache the ARAP LU factorisation | `arap.py` | Matrix is the same every frame | 6.15 s → 4.40 s per 90-frame wave (chapter 12) |
| Vectorised point-in-outline tests (Shapely 2) | `animated_drawing.py` `_generate_mesh` | Python loop was slow | Mesh 1.2–2.7 s → ~0.1 s, **identical** output |
| 90-frame cap | `batch_animate.py` | Scenes are only seconds long | Ablation in [03 §3.3.3](03_MODEL_METRICS.md) |
| 320 px render copy | `make_render_copy()` | Characters are ~275 px tall on screen | ~4.0 → 2.3 s per motion (chapter 14) |
| Clear error for mismatched BVH/retarget pairs | `retargeter.py` | Confusing crashes | Readable error |

---

## 1.7 Stage 5: The Story Video

**File:** `story_engine/compose_story.py`.

The story is "Rahim's Family": **9 scenes** over 23.75 s, matching a recorded narration (`rahim_story_audio.mp3`). The text and timings are in `assets/Rahim's Story/timestamps`. Each scene names a background (bedroom, hallway, kitchen, garden) and which characters appear, with their motion, position (x, y as fractions of the screen), scale and anchor (feet on the floor).

How it is built:
1. Load each needed character GIF once, crop all frames to the union of their non-empty areas, resize **once** to the scene's scale, and cache the result.
2. For each scene, frame count = `round(end × 24) − round(start × 24)`. This keeps the picture locked to the narration, as proved in [02 §2.11](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md).
3. Draw background plus characters into each 1280 × 720 frame and **stream the raw pixels straight into one FFmpeg process**, which encodes H.264 video and adds the narration in **one pass**. No frame files are written.
4. Write to a `.part` file, rename it when complete, and print the video's address for the server.

Result: 14.5 ± 1.9 s per story ([03 §3.3.4](03_MODEL_METRICS.md)).

> **What changed from the first version.** The first story engine (`tell_story_video.py`, removed in the cleanup; see textbook chapter 15) used MoviePy and generated speech from captions with Google's gTTS service. It was replaced, partly because gTTS sends text to Google, and partly because MoviePy was slow. The current system uses no online service (see [04](04_WHY_NO_GENERATIVE_AI_APIS.md)).

---

## 1.8 Stage 6: How a Child Makes a Story (Story Studio)

1. The student opens **Story Studio** from an assignment or from Play for Fun.
2. There are six character slots: Rahim, Sister, Mother, Father, Grandma, Grandpa. Each starts with a ready-made default character.
3. For any slot, the child or teacher **uploads a drawing** (and can fix it in the Fixer).
4. `POST /api/story/prepare` creates a job. For each new drawing it runs `prepare_character_api.py` (Stages 1–2), then `batch_animate.py` for **only the motions that character needs** (for example, Rahim needs idle, wave and jump; Sister needs only sleep). Both use the AI server if it is running, otherwise a new process. The page polls `GET /api/jobs/:id` and shows Wait → Loading → Ready per slot.
5. **Make Video** calls `POST /api/story/generate` → `compose_story.py`.
6. The video plays and is saved as a `StudentStory` linked to the child, so the teacher and the parent can watch it. Videos are streamed only to the owner, a linked parent, or a teacher (checked in `routes/files.js`).

---

## 1.9 The Classroom Platform

**Data model** (`platform/api/prisma/schema.prisma`, PostgreSQL):

| Table | Holds |
|---|---|
| `User` | username, bcrypt password hash, display name, avatar, role (ADMIN, TEACHER, PARENT, STUDENT) |
| `Class`, `ClassMembership` | classes, and who is in them as TEACHER or STUDENT (a student may be in several classes) |
| `ParentChild` | parent ↔ child links |
| `Application` | registered apps (Story Studio and the six games) with launch addresses |
| `Assignment` | title, class, app, optional single student |
| `ActivityResult` | score, status and details per student per attempt |
| `StudentStory` | a child's saved story video |

**Roles and what they can do:**

| Role | Can |
|---|---|
| Admin | Bulk-enrol students with parents (all-or-nothing), link and unlink families, delete students/parents/classes, view school totals |
| Teacher | Create and delete classes, add and remove students, assign an app to a class or one student, delete assignments, see results |
| Parent | See linked children, their classes, assignments, scores and story videos; add a child with just a name and avatar |
| Student | Log in by **choosing a class, then tapping their avatar** (no password); see that class's assignments; play for fun |

**How the security works** (details and proofs in [02 §2.14](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md) and [08](08_SECURITY_PRIVACY_AND_LICENSING.md)):
- Login returns a signed JWT (1 day). Student tokens carry the chosen class, and assignments are filtered to that class.
- Launch checks that the assignment belongs to this student, this class and this app, then signs a **1-hour app token** containing the `assignmentId`.
- Results are accepted only with a valid app token, and only for **its own** assignment.
- Request IDs follow each request across services, and tokens are hidden in logs.

---

## 1.10 How the Work Was Done (Timeline)

From the git history and the textbook:

| When (2026) | Work |
|---|---|
| July | First engine with YOLO and MediaPipe; dataset coordinate fixes (ch. 2); Colab training (ch. 5); padding augmentation and scaling (ch. 6) |
| August | Pivot to "collaborative story animation"; a review of image-to-video **APIs with pricing** was written and then **reverted**, so the team chose local models ([04](04_WHY_NO_GENERATIVE_AI_APIS.md)) |
| 1–3 Sept | Core engine working; first story engine sealed |
| 15–20 Sept | Fixer and story UI with rembg; **`best.pt` integrated** (17/17 joints); GPU inference |
| 21 Sept | Story engine with background jobs, caching and the frame cap (ch. 9) |
| 8–11 Oct | Engine tuning; platform foundation (API, database, student portal); parent app |
| 17 Oct | Activity Center hub and games; the six family characters |
| Late Oct to 5 Nov | Admin console and onboarding; speed work: AI server back, one-pass FFmpeg, loaded engine, 320 px copies (ch. 14) |
| Nov | Database audit and fixes (class-scoped assignments, delete route, safe bulk enrolment, separate test database); sinking-head fix; repository cleanup (ch. 15); this documentation |

**Working method:** each change was measured before and after (chapter 14). Big changes were compared exactly against the old output where possible (the mesh), and the API changes are covered by automated tests that run on a separate database.

---

## 1.11 Reproducing the System

1. Install Node.js 18+, PostgreSQL 14+, and Python 3.9 with PyTorch (CUDA optional).
2. Install Python packages: `ultralytics`, `rembg`, `opencv-python`, `scikit-image`, `scipy`, `shapely>=2`, `pyyaml`, `flask`, `imageio-ffmpeg`, `Pillow`. Then install the engine with `pip install -e "Actual repo (EDUVISION)/AnimatedDrawings"`.
3. Run `npm install` in `platform/api`, `platform/portal`, `platform/activity-center`, `platform/student-story-studio` and `eduvision_ui`.
4. Create `platform/api/.env` with `DATABASE_URL` and a strong `JWT_SECRET` (required: there is no default).
5. In `platform/api`, run `npx prisma migrate deploy`, then `node seed.js` (or `node seed-demo.js` for sample classes).
6. Run `start-eduvision.bat`. Wait until the AI server window says it is ready.
7. To check: `npm test` in `platform/api` (53 tests, separate database), and `python docs/evidence/run_benchmarks.py` for the measurements.

`best.pt` is committed to the repository, so no download is needed.
