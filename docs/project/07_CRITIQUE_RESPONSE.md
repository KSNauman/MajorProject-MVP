# 7. Response to the Two Reviews of the EduVision Paper

Sir shared two independent critiques of the manuscript *"EduVision: Turning Sketches into Animations for Interactive Kindergarten Classrooms"*:
- **Review A:** `EduVision1_Paper_Critique-ChatGpt.docx`. Verdict: **Major Revision**.
- **Review B:** `EduVision_Manuscript_Critique-Claude (1).docx`. Verdict: **Major revision for a research venue**.

Both reviews read **only the manuscript**; neither looked at the code. Since that manuscript was written, the system has changed. Several reported problems are now **fixed in the code**, some are **answered with new evidence** in this documentation, and some remain **open** with a plan.

This document goes through every point honestly.

**Status labels:**
- ✅ **Fixed** — changed in the code and covered by a test.
- 📄 **Answered** — the evidence or description now exists in these documents.
- 🟡 **Partly** — some of it is addressed.
- ⛔ **Open** — not done yet; the plan is given.
- ↩️ **Clarification** — the reviewer's reading of the manuscript was understandable, but the system actually does something else, and the paper must say so more clearly.

---

## 7.1 Where Both Reviewers Agree (the important points)

| # | Concern | Status | What we did / will do |
|---|---|---|---|
| 1 | **Launch endpoint did not check the assignment belongs to the student's class** (A 4.9, B 3.4) | ✅ Fixed | `integration.js` now refuses launch unless the assignment belongs to **this student, this class and this app** (`utils/assignmentAccess.js`). Tests in `data_integrity.test.js`. The paper must say "fixed" and drop the caveat |
| 2 | **Failing test: enrolling a student in a second class** (A 4.7, B 3.8) | ✅ Fixed | The rule was decided: a student **may** be in several classes, but not twice in one, and sees only the class they logged in through. This also fixed a real bug where students saw every class's assignments. Test updated; **53/53 tests pass** |
| 3 | **No dataset description** (A 4.2, B 3.1) | 🟡 Partly | Training settings, history and final scores are recovered from inside `best.pt` ([03 §3.1](03_MODEL_METRICS.md)). The source is Meta's Amateur Drawings dataset. The **exact size of the final dataset is not recoverable** from the repository; the training notebook must be added |
| 4 | **No pose-accuracy metric** (A 4.3, B 3.1) | 🟡 Partly | Now reported: box precision/recall 0.940/0.928; **pose mAP50 0.946, mAP50-95 0.747**; full 96-epoch curves. **But** these are validation-split scores, not an untouched test set. Plan in [03 §3.7](03_MODEL_METRICS.md) |
| 5 | **No baseline and no ablation** (padding, hybrid mask, Fixer) | ⛔ Open | Protocols written ([03 §3.7](03_MODEL_METRICS.md)). The **frame-cap ablation is now done** (see row 7) |
| 6 | **"27.84 s → 0.37 s" is not in the deployed path; cold/warm undefined** (A 4.6, B 3.2) | ✅ Fixed + 📄 | The AI server **is now deployed** (`start-eduvision.bat` starts it on port 5001). Re-measured with definitions: **cold** (new process) **28.1 ± 3.0 s (n = 3)** vs **warm** (models loaded) **1.32 ± 0.05 s (n = 5)** for detection plus segmentation plus files. The model alone takes **13.7 ± 7.0 ms** on GPU. Hardware is stated ([03 §3.3](03_MODEL_METRICS.md)) |
| 7 | **"600 s → 54 s" mixes three causes; is 54 s cold or cached?** | ✅ Answered | Measured separately. **Frame cap alone:** wave 9.23 s → 2.31 s, jump 3.83 s → 2.39 s (n = 2 each). Most of the old 10 minutes came from **restarting Python and rebuilding the mesh for every motion**. Chapter 14 also shows the "54 s" and the later measurements did not measure the same thing. Current, fair numbers: **6 characters in 50.3 s, story 14.5 ± 1.9 s** |
| 8 | **Frame cap may cut motions; no frame rate given** (B 3.2) | 📄 Answered, ⛔ fix open | Quantified: the cap keeps 3.0 s of the 8.3 s motions and only 0.75 s of the 7.0 s wave, which then plays 2.4× slow ([02 §2.10](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)). Fix: sample frames evenly (future work 12) |
| 9 | **Educational claims without any study** (A 4.8, B 3.5) | ⛔ Open | Agreed. All learning goals are now labelled "design intention" ([05](05_ACTIVITY_CENTER.md), [06](06_ADVANTAGES_LIMITATIONS_FUTURE.md)). A pilot is planned (future work 11). **The paper's title and abstract must say "prototype"** |
| 10 | **Child-data protection, consent, retention** (A 4.9, B 3.4) | 🟡 Partly | A full threat model and data inventory are written ([08](08_SECURITY_PRIVACY_AND_LICENSING.md)). This audit **found a new issue**: children's names are sent to `api.dicebear.com` in avatar addresses. Consent and retention are still open |
| 11 | **JWT details missing** (A 4.9, B 3.4) | 📄 Answered | HS256; login tokens last 1 day, app tokens 1 hour; the app token is bound to the `assignmentId`; no default secret; tokens hidden in logs ([02 §2.14](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md), [08](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| 12 | **Scalability not demonstrated** | 🟡 Partly | Explained and modelled: one queue, $C_n \approx np + a\sum m_i$, matching the measured 50.3 s ([02 §2.15](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)). A 30-upload load test is still open |
| 13 | **Reproducibility: versions, config, what was modified** | 📄 Answered | Versions, settings and a list of every change to AnimatedDrawings ([01 §1.6](01_SYSTEM_OVERVIEW_AND_METHODS.md)); a benchmark script anyone can run; `best.pt` committed |
| 14 | **Related work is thin; novelty not sharp** | ⛔ Open (paper text) | Reading list below (§7.4). Suggested contribution statement in §7.5 |
| 15 | **Mesh tearing is a core failure** | ⛔ Open | Acknowledged as limitation 6.2.2-1; fix idea: layered limbs (future work 13) |

---

## 7.2 Review A Only (ChatGPT critique)

| Point | Status | Response |
|---|---|---|
| Section 4.4: intersection may drop thin or detached parts; give parameters | ✅ + 📄 | All parameters given (115 px window, C = 8, 3 × 3 kernel, 2 closings, 2 dilations). A **thin-drawing rescue** was added: when rembg keeps under 90% of the strokes, whole touching strokes are added back ([02 §2.4](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)). Detached parts are still dropped (limitation) |
| Section 4.5: animation quality not measured | ⛔ | Rater protocol in [03 §3.7](03_MODEL_METRICS.md) |
| Section 4.7: test matrix and coverage | 📄 | The six suites and what each covers are in [03 §3.6](03_MODEL_METRICS.md); 53/53 pass |
| Section 4.10: deployed vs prototype | ✅ | Nothing is "prototype only" any more: the AI server is in the launcher |
| Section 6, Fig. 4: bar plotted at 600 for "> 600 s" | 📄 | Replace both bar charts with one table of mean ± SD (n), hardware, cold/warm ([03 §3.3](03_MODEL_METRICS.md)) |
| Questions 1–12 | 📄 | Answered one by one in §7.6 |

---

## 7.3 Review B Only (Claude critique)

| Point | Status | Response |
|---|---|---|
| "Only Story Studio uses the full pipeline; other activities are described without animation use" | ↩️ | **All six games use engine animations**, through three routes: pre-rendered story characters (full pipeline), pre-rendered solid humanoids (template skeleton), and live calls (template skeleton). The table in [05 §5.4](05_ACTIVITY_CENTER.md) states exactly which route each game uses. The paper must include this table |
| "Count & Play: no recognition method described" | 📄 | Distance-weighted 3-NN on 8 × 8 features from scikit-learn's digits data; **98.94% 10-fold accuracy on that data**, per-digit recall and confusion matrix given ([03 §3.4](03_MODEL_METRICS.md)); not measured on children |
| "Caching only applies to Story Studio" | ↩️ Correct | Confirmed: Activity Center live renders are not cached (limitation, future work 18) |
| Result integrity: client-side scores | ⛔ | Agreed; documented ([05 §5.5](05_ACTIVITY_CENTER.md), [08 §8.3](08_SECURITY_PRIVACY_AND_LICENSING.md)); server-side scoring is future work |
| Passwordless login threat model | 📄 | Stated: supervised, school-controlled devices ([08 §8.3](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| **AGPL-3.0 licence of YOLOv8** | 📄 | Confirmed: `best.pt` itself declares AGPL-3.0. An open project is fine; a closed commercial product would need an Ultralytics licence ([08 §8.5](08_SECURITY_PRIVACY_AND_LICENSING.md)) |
| Developmental mismatch: tadpole figures and scribbles | 📄 | Agreed limitation 6.2.1-1; future work 20 |
| Fig. 2 is one tidy success case; show failures | ⛔ (paper) | Add the failure gallery: crossed arms (tearing), detached hand, a non-detected drawing from the 22 in §3.2, and a thin stick figure before and after the rescue |
| "Redundant detection pass" | ↩️ | The second pass runs on the **cropped** figure at full resolution, which gives sharper keypoints than the first pass on the whole (possibly downscaled) photo. If it finds nothing, the first keypoints are reused. The paper should state this reason; the extra cost is about 14 ms on GPU |
| "2D vs 3D inconsistency" | ↩️ | The character is a **2D mesh**. The **motion** is 3D (BVH) and is projected to 2D first ([02 §2.8](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)). The sentence "deform the 3D character" in the paper is wrong and must be corrected |
| Equations (4)–(5) carry no content | 📄 | Replace them with the ARAP energy, the two-step solve, and the projection rule ([02 §2.7–2.8](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)) |
| PCA citation to a textbook; 2D ARAP citation missing | 📄 | Cite Igarashi, Moscovich & Hughes 2005 and Igarashi & Igarashi 2009 (the exact paper named in `arap.py`), and the AnimatedDrawings paper for the projection rule |
| "Correction interface is not new" | ↩️ Partly agree | Meta's demo lets users fix the mask and joints. Ours adds **drawing missing limbs** and **erasing**, keeps hand-placed joints over model joints, and is part of the classroom flow. Claim it as an **integration**, not a new idea |
| Abstract repeats numbers; caveat repeated about 7 times | ⛔ (paper) | Report each result once, in the results section; the caveat is no longer needed now the AI server is deployed |
| Uncited "standard pose models produce very poor keypoints" | 📄 | Our own evidence exists: chapter 8 (MediaPipe failure). Better: run the COCO-baseline test (future work 6) and cite the number |

---

## 7.4 Literature to Add (from both reviews; check every reference before citing)

| Area | Works |
|---|---|
| Sketch animation | Smith et al. 2023, *A Method for Animating Children's Drawings of the Human Figure* (ACM TOG), plus its code and dataset release; Dvorožňák et al. 2020, *Monster Mash* |
| Deformation | Igarashi, Moscovich & Hughes 2005, *As-Rigid-As-Possible Shape Manipulation*; Igarashi & Igarashi 2009 (JGT) |
| Pose and keypoints | Lin et al. 2014 (COCO); Maji et al. 2022, *YOLO-Pose*; work on pose and person detection in artwork (e.g. Westlake et al. 2016) |
| Segmentation | Qin et al. 2020, *U²-Net* |
| Digit recognition | Alpaydin & Kaynak 1998 (UCI digits); Cover & Hart 1967 |
| Security | RFC 7519 (JWT); OWASP Top 10, Broken Access Control |
| Children and design | Papert (constructionism); Kellogg and Lowenfeld (stages of children's drawing); Hourcade and Druin (child–computer interaction); WHO/AAP screen-time guidance |
| Law | India DPDP Act 2023; COPPA; GDPR Article 8 |

---

## 7.5 Suggested Revision of the Paper

**Title:** *EduVision: A Local, Privacy-Preserving Prototype That Animates Children's Drawings for Early-Years Learning Activities*

**Contribution statement (three precise claims):**
1. A **drawing-specific pose model** (YOLOv8n-pose fine-tuned with padding augmentation; pose mAP50 0.946 on validation), combined with a **hybrid mask** and a **human correction tool**, so that real children's drawings can be rigged reliably.
2. An **optimised local animation service** that brings six characters from 9–12 minutes to about 50 s on a laptop GPU, with each cause measured separately (process reuse, frame cap, factorisation caching, vectorised meshing).
3. **One animation engine reused across a story maker and six learning games**, inside a role-based classroom platform with class-scoped, token-bound authorisation, and **no external AI services**.

**Results section:** replace Figures 3–4 with the tables in [03 §3.3](03_MODEL_METRICS.md), and add the training table and curves in [03 §3.1](03_MODEL_METRICS.md).

**Limitations section:** copy [06 §6.2](06_ADVANTAGES_LIMITATIONS_FUTURE.md) in shortened form.

---

## 7.6 Answers to Review A's Twelve Questions

1. **How many training, validation and test sketches; how many by real children?** The final checkpoint records the dataset name (`eduvision_pose_v2_dataset`) but not its size. An earlier version used 1,200 images split 960/180/60. The data came from Meta's Amateur Drawings dataset, which was collected from the public, not from our target classrooms. **To fix:** add the notebook and the dataset manifest.
2. **Annotation protocol?** The dataset's own annotations, converted to YOLO format with a coordinate correction (textbook chapter 2). Inter-annotator agreement was not checked by us.
3. **Evidence that padding helps?** A theoretical argument ([02 §2.3](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)) and the observed end of the "A-pose" collapse (chapter 6). There is no controlled ablation yet.
4. **Segmentation accuracy?** Not measured, because there is no labelled mask set. Behaviour on 178 uploads is reported ([03 §3.2](03_MODEL_METRICS.md)).
5. **How is frontal vs PCA chosen?** It is set per body group in the retarget config. For "pca", the third principal component is snapped to the nearer of the $x$ or $z$ axis ([02 §2.8](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)).
6. **What was modified in AnimatedDrawings; how is tearing handled?** See the table in [01 §1.6](01_SYSTEM_OVERVIEW_AND_METHODS.md). Tearing is **not** handled yet.
7. **How many runs; what hardware?** Now reported for every number: n = 2 to 30, mean ± SD, RTX 2050 laptop ([03](03_MODEL_METRICS.md)).
8. **How much does each optimisation contribute?** Frame cap: 4× on the wave, 1.6× on 250-frame motions. Reusing the loaded engine: about 10 s → 5.8 s per motion. Batched mesh checks: → 4.0 s. 320 px copy: → 2.3 s (chapter 14 §6.3). ARAP factorisation caching: 6.15 s → 4.40 s (chapter 12).
9. **Is class membership enforced before issuing a launch token?** **Yes, since November 2026**, with tests.
10. **What data about children is kept, for how long; consent?** See the inventory in [08 §8.1](08_SECURITY_PRIVACY_AND_LICENSING.md). Retention and consent are **not yet defined** (open).
11. **Expected concurrent students; tested?** One class (about 30) on one machine, through one queue. Not load-tested yet.
12. **Evidence of usability for kindergarten?** None beyond the design and functional tests. A pilot is planned.
