# EduVision Project Textbook

A comprehensive engineering log documenting the full lifecycle of the EduVision project — from initial research and model training to failures, pivots, and final delivery.

---

## 📖 Chapters

### Part I — Machine Learning & Pose Estimation
| Chapter | Topic |
|:---|:---|
| [Chapter 1](chapter1_yolo_pose.md) | Deep Learning Pose Estimation (YOLOv8-Pose) |
| [Chapter 2](chapter2_data_coordinates.md) | Dataset & Coordinate System Alignment |
| [Chapter 3](chapter3_training_mechanics.md) | Training Mechanics, GPU Workflows & Metrics |

### Part II — Graphics & Rendering
| Chapter | Topic |
|:---|:---|
| [Chapter 4](chapter4_graphics_rendering.md) | 2D Graphics Geometry & Physics Deformations |
| [Chapter 5](chapter5_colab_workflow.md) | Cloud GPU Workflows & Colab Automation |
| [Chapter 6](chapter6_cloud_scaling.md) | Cloud Scaling & Deployment |

### Part III — Failures & Pivots
| Chapter | Topic |
|:---|:---|
| [Chapter 7](chapter7_failure_and_pivot.md) | YOLOv8 Training Failure & Mode Collapse |
| [Chapter 8](chapter8_mediapipe_web_failure.md) | MediaPipe Web Pose Estimation Failure |

### Part IV — Story Engine & Final Delivery
| Chapter | Topic |
|:---|:---|
| [Chapter 9](chapter9_story_engine.md) | Story Engine Architecture & Implementation |
| [Chapter 10](chapter10_polishing_and_compositing.md) | Polishing, Compositing & Final Output |

### Appendices
| File | Topic |
|:---|:---|
| [Appendix A](chapter_appendix_3d_retargeting_physics.md) | 3D-to-2D Retargeting Physics |
| [Appendix B](chapter_appendix_project_idea.md) | Original Project Idea & Scope |
| [Appendix C](chapter_appendix_colab_training_guide.md) | Colab Resumable Training Guide |
| [Appendix D](chapter_appendix_roboflow_guide.md) | Roboflow Dataset Training Guide |
| [Appendix E](chapter_appendix_yolo_model.md) | YOLO Model Notes & Results |
| [Appendix F](chapter_appendix_todo.md) | Project TODO Log |

---

## 🗂️ Current Active System

```
story_engine/         ← Final working story generator
yolo_test/            ← Trained best.pt + inference scripts
training_pipeline/    ← Model training reference scripts
textbook/             ← This documentation
```
