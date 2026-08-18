# Chapter 7: Deep Learning Failure & Architecture Pivot

In this chapter, we log a critical architectural failure regarding the custom-trained YOLOv8-pose model and document the strategic pivot back to the Meta AnimatedDrawings baseline models.

---

## 1. The Custom Deep Learning Failure
Despite successfully engineering a cloud-scale pipeline to stream and pad 11,500 children's drawings in Google Colab (Phase 2), the trained Nano model (`yolov8n-pose.pt`) failed to generalize during inference. 

When tested on highly abstract, thick-marker humanoid sketches, the neural network consistently exhibited severe **Mode Collapse**—completely ignoring the physical ink of the drawing and instead projecting a mathematically rigid A-pose template relative to the image bounding box.

### Root Cause Diagnosis:
1. **Model Capacity Constraint:** The Nano-tier YOLO model (containing only ~3 million parameters) lacked the representational capacity required to learn complex visual joint features from the extreme morphological variance present in children's sketches. 
2. **Loss Landscape Regression:** When faced with severe abstraction (e.g., lack of necks, merged limbs, thick untextured marker strokes), the neural network's convolution filters failed to activate. As a result, the model minimized its loss by regressing to the dataset statistical mean (the A-pose). 

---

## 2. The Pivot Strategy
Because scaling to the X-Large YOLO model (`yolov8x-pose`) would require prohibitive GPU compute costs (weeks of training) and would be too slow for real-time web inference, we are officially abandoning the custom YOLOv8 training architecture.

**The Solution:** We will integrate the original, heavy `.mar` models provided by the Meta AnimatedDrawings repository (`drawn_humanoid_detector.mar` and `drawn_humanoid_pose_estimator.mar`). 

### Bypassing Docker for Native Windows Execution
The Meta repository strictly relies on Docker to host these models via `TorchServe`. To maintain a lightweight native environment for the Eduvision Node.js backend, we will discard Docker entirely. 

Our new implementation strategy:
1.  Configure **Java JDK 17** on the host machine.
2.  Install `torchserve` natively in the Python environment.
3.  Download the `.mar` weights into a local `model-store`.
4.  Run TorchServe on `localhost:8080` natively in the background.
5.  Restore the original `image_to_annotations.py` inference scripts to ping the local TorchServe API for bounding box and keypoint extraction.
