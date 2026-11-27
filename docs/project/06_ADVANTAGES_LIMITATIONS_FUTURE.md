# 6. Advantages, Limitations and Future Work

Every claim below points to its evidence. Where something is an intention rather than a measured result, it says so.

---

## 6.1 Advantages

### Technical

| Advantage | Evidence |
|---|---|
| **The child's own drawing moves.** No pixel is invented, so the child recognises their work | Proof in [04 §4.5](04_WHY_NO_GENERATIVE_AI_APIS.md): every output pixel is a sample of the original drawing |
| **A pose model made for drawings,** small and fast | 3.3 M parameters, 20 MB; validation pose mAP50 0.946, mAP50-95 0.747; 13.7 ms per drawing on GPU, 67 ms on CPU ([03 §3.1](03_MODEL_METRICS.md)) |
| **Human correction built in.** A teacher fixes joints, erases marks or draws a missing limb in seconds | Fixer ([01 §1.5](01_SYSTEM_OVERVIEW_AND_METHODS.md)); needed because about 1 in 8 real uploads had no figure detected ([03 §3.2](03_MODEL_METRICS.md)) |
| **Fast enough for a lesson** | Six characters ready in 50.3 s, story video 14.5 s ([03 §3.3](03_MODEL_METRICS.md)); the old way took 9–12 minutes |
| **All AI runs on one ordinary laptop** | All models are local; no API keys ([04](04_WHY_NO_GENERATIVE_AI_APIS.md)). The pages still load fonts, two libraries and avatars from the web until these are bundled ([08 §8.1](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| **Repeatable output** | The same input gives the same animation; the mesh speed-up was checked to give identical output |
| **Graceful fallbacks** | AI server off → new process; engine fails in Color & Animate → CSS animation; no figure found → whole image is used |
| **One engine, many uses** | Story Studio and six games all reuse the same animation engine and characters ([05](05_ACTIVITY_CENTER.md)) |

### Educational and practical

| Advantage | Status |
|---|---|
| **No reading or typing needed:** avatar login, spoken number words, picture-based games | Built; not yet tested with children |
| **Teachers and parents connected:** assignments, scores and story videos visible to the right people only | Built and covered by 53 automated tests |
| **Zero running cost** | About ₹2.9 lakh per class per year compared with a video-generation API ([04 §4.4](04_WHY_NO_GENERATIVE_AI_APIS.md)) |
| **Privacy by design:** drawings never leave the school computer | Built; consent process still needed ([08](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| **Curriculum coverage:** colours, visual discrimination, counting 2–8, writing digits, part–whole puzzles, number order and skip counting | Built; learning effect **not measured** |

---

## 6.2 Limitations

### 6.2.1 Recognition

1. **Humanoid figures only.** Animals, vehicles, tadpole figures (a head with legs) and scribbles do not fit the 17-joint skeleton.
2. **About 12% of real uploads were not detected** (22 of 178), and confident keypoints can still be wrong ([03 §3.2](03_MODEL_METRICS.md)).
3. **Accuracy is validated, not tested.** The reported mAP is on the validation split used to pick the checkpoint; there is no untouched test set of real children's drawings, no baseline comparison and no padding ablation ([03 §3.1.4](03_MODEL_METRICS.md)).
4. **The training data is not fully documented.** The exact size and source mix of the final dataset are not in the repository.
5. **A detached body part is dropped.** The mask keeps only the largest outline, so a floating hand disappears unless it is drawn back in the Fixer ([02 §2.4](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)).
6. **Light or coloured strokes and shadowy phone photos** can confuse the adaptive threshold.

### 6.2.2 Animation

1. **The mesh tears when limbs overlap**, for example arms crossed over the chest (test UT_1.11 fails).
2. **The 90-frame cap cuts long motions.** The wave keeps only 0.75 s of 7 s and plays 2.4× slow ([02 §2.10](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)).
3. **Six motions only**, all from existing motion-capture files.
4. **The 320 px render copy changes bending slightly;** one test frame showed a small foot flaw (chapter 14).
5. **A character can look smaller in the jump scene,** because its size is measured from the whole jump.
6. **One story only** ("Rahim's Family", 9 fixed scenes, one recorded narration in English).

### 6.2.3 System and operations

1. **One machine, one queue.** The AI server holds about 3 GB of RAM and handles one request at a time; 30 children uploading at once would wait in line (§2.15 model: about 2.5 s per motion). Not load-tested.
2. **A failed animation can still show "Ready"** in Story Studio.
3. **Generated files grow without limit** (`uploads/`, `story_engine/output/`); there is no cleanup job.
4. **Activity Center live animations are not cached.**
5. **Windows-first launcher.** The `.bat` scripts and some paths assume Windows.

### 6.2.4 Security and privacy

1. **Passwordless student login** lets anyone at the device pick any child in a class. Acceptable only with supervised, school-controlled devices.
2. **Game scores are computed in the browser** and could be edited by the student for their own assignment.
3. **Bulk-enrolled accounts share the password `password123`** until changed.
4. **The Story Engine (port 3000) has no login** and serves uploaded drawings and videos to anyone on the network.
5. **No consent, retention or deletion policy** is written yet for children's data.
6. **A child's name is sent to `api.dicebear.com`** in avatar addresses ([08 §8.1](08_SECURITY_PRIVACY_AND_LICENSING.md)).

### 6.2.5 Educational evidence

1. **No study with children or teachers has been done.** All learning goals are design intentions.
2. **No accessibility work yet:** no language other than English, no screen-reader support, and touch sizes not tested with small hands.
3. **Screen-time guidance** for this age group has not been built into the design.

---

## 6.3 Future Work (in priority order)

### Must do before any classroom use

| # | Work | Why |
|---|---|---|
| 1 | Add login to the Story Engine (port 3000), or serve its files only through the Platform API | Children's drawings are currently open on the network |
| 2 | Force a password change for bulk-enrolled accounts | Shared default password |
| 3 | Write a consent form, a retention period and a deletion process (DPDP Act) | Legal requirement for children's data |
| 4 | Show "Failed" (not "Ready") when an animation fails | Honest feedback |
| 4a | Stop putting children's names in DiceBear avatar addresses; bundle fonts and libraries locally | Privacy and offline use |

### Research and evaluation (answers the reviewers)

| # | Work | Outcome |
|---|---|---|
| 5 | Label 100–200 real children's drawings as an untouched test set; report OKS-mAP and PCK per joint | True accuracy |
| 6 | Baselines (COCO YOLOv8-pose, Meta's detector) and a padding-augmentation ablation | Proves the custom model's value |
| 7 | Hand-drawn mask set; IoU and Dice for rembg alone, threshold alone, hybrid | Proves the hybrid mask's value |
| 8 | Log Fixer use (share of drawings fixed, seconds, edits) | Proves the Fixer's value |
| 9 | Rater study of animation quality (Cohen's κ) | Animation quality number |
| 10 | 30-upload load test: p50/p95 time, peak memory | Classroom readiness |
| 11 | Ethics-approved pilot with 1–2 classes and teachers: usability, engagement, task completion | Educational evidence |

### Product improvements

| # | Work |
|---|---|
| 12 | Sample motion frames evenly instead of taking the first 90 (fixes slow, cut-off waves at the same cost) |
| 13 | Layered limbs or depth ordering to stop tearing when limbs overlap |
| 14 | Keep detached parts: attach small nearby components to the nearest limb instead of dropping them |
| 15 | More motions (run, clap, sit, celebrate) and more stories, with teacher-made stories as data instead of code |
| 16 | Kannada and Hindi narration recorded locally, and interface language options |
| 17 | Server-side score checks for games |
| 18 | Cache Activity Center animations; scheduled cleanup of old uploads |
| 19 | Child-written digit samples to retrain the k-NN digit model |
| 20 | Retrain the pose model on non-humanoid and tadpole figures, or add a simple "blob character" rig for them |
| 21 | Cross-platform launcher (Docker Compose for servers, optional) and a cloud option for schools without a GPU |
| 22 | Optional teacher-only AI story ideas, following the safe pattern in [04 §4.8](04_WHY_NO_GENERATIVE_AI_APIS.md) |
