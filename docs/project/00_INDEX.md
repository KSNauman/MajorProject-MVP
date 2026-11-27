# EduVision Project Documentation: Index

This folder describes the system **as built** in November 2026. Every number in it comes from the code, from the trained model file, or from a benchmark run that you can repeat (see `docs/evidence/`). Anything that has not been measured is labelled as such.

The [textbook](../../textbook/README.md) is the history of how the project developed, including plans that were later dropped. These documents describe the current state.

---

## Documents

| # | Document | What it covers |
|---|---|---|
| 01 | [System Overview and Methods](01_SYSTEM_OVERVIEW_AND_METHODS.md) | Architecture, the six processes, each pipeline stage and how it was built, the Fixer, the story video, the platform, the timeline and how to reproduce the results |
| 02 | [Mathematical Foundations and Proofs](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md) | Skeleton, OKS/mAP, padding augmentation, segmentation, Delaunay mesh, barycentric pins, ARAP, PCA, the frame-cap time model, the no-drift frame proof, k-NN, scoring, security and the queue model |
| 03 | [Model Metrics](03_MODEL_METRICS.md) | The pose model's training and validation results, speed on GPU and CPU, behaviour on 178 real uploads, stage timings, frame-cap ablation, k-NN accuracy, test suites and what is not measured yet |
| 04 | [Why No Generative-AI APIs](04_WHY_NO_GENERATIVE_AI_APIS.md) | Provider age terms, privacy and the DPDP Act, a cost calculation using real prices, the pixel-preservation proof and a safe pattern for future use |
| 05 | [Activity Center](05_ACTIVITY_CENTER.md) | How each of the six games is built, its learning goal, its scoring, and which of the three animation routes it uses |
| 06 | [Advantages, Limitations and Future Work](06_ADVANTAGES_LIMITATIONS_FUTURE.md) | Advantages with evidence, limitations, and a prioritised list of future work |
| 07 | [Response to the Reviews](07_CRITIQUE_RESPONSE.md) | Each point from the two reviews, what was fixed, what was documented and what is still open; answers to the reviewer's questions |
| 08 | [Security, Privacy and Licensing](08_SECURITY_PRIVACY_AND_LICENSING.md) | Data inventory, controls, threat model, children's data law, and the licence of every component |

## Evidence files (`docs/evidence/`)

| File | Contents |
|---|---|
| [`run_benchmarks.py`](../evidence/run_benchmarks.py) | Script that produces all the speed and accuracy numbers. Run `py -3.12 docs/evidence/run_benchmarks.py`; set `ONLY=<section>` to re-run one section |
| [`benchmarks.json`](../evidence/benchmarks.json) | Results from 27 November 2026 (RTX 2050 laptop): model speed, 178-upload detection, extract/animate/compose times, frame-cap ablation, k-NN cross-validation |
| [`pose_model_training.json`](../evidence/pose_model_training.json) | Training settings and per-epoch history read from inside `best.pt` |
| [`pose_model_training_curves.png`](../evidence/pose_model_training_curves.png) | Validation mAP and loss curves drawn from that history |

---

## Where each documentation requirement is answered

| Requirement | Where |
|---|---|
| 1. Mathematical or other proofs of the work | [02](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md) (all sections); [04 §4.5](04_WHY_NO_GENERATIVE_AI_APIS.md) (pixel preservation) |
| 2. All possible metrics of every model | [03](03_MODEL_METRICS.md), with raw data in `docs/evidence/` |
| 3. Full description of every piece of work and how it was done | [01](01_SYSTEM_OVERVIEW_AND_METHODS.md), plus [05](05_ACTIVITY_CENTER.md) for the games |
| 4. Why no generative-AI API keys were used, with pricing and other proof | [04](04_WHY_NO_GENERATIVE_AI_APIS.md) |
| 5. Activity Center: how each game is built and uses the animation engine | [05](05_ACTIVITY_CENTER.md) |
| 6. Advantages, limitations and future scope | [06](06_ADVANTAGES_LIMITATIONS_FUTURE.md) |
| 7. Correcting misleading textbook content | [textbook/README.md](../../textbook/README.md) rewritten; "Update (November 2026)" notes added at the top of chapters 3, 7, 9, both chapter 10 files, 13 and the audit report; chapter 11's MoviePy line corrected |
| Extra: security, privacy and licences | [08](08_SECURITY_PRIVACY_AND_LICENSING.md) |
| Extra: analysis of the two reviews | [07](07_CRITIQUE_RESPONSE.md) |

## Most important findings

- The pose model's scores (pose mAP50 0.946, mAP50-95 0.747) come from the **validation** split. There is no separate test set of real children's drawings yet.
- On 178 real uploads, **22 (12%) had no figure detected**, which is why the Fixer matters.
- **A child's display name is sent to `api.dicebear.com`** in avatar addresses. This is the only personal data that leaves the computer.
- **The Story Engine on port 3000 has no login**, and bulk-enrolled accounts share the default password `password123`. Both must be fixed before classroom use.
