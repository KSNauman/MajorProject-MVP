# Chapter 10: GPU Acceleration & Performance Architecture

## 1. Overview
As EduVision evolved from a proof-of-concept into a robust MVP, performance became a critical bottleneck. The original architecture relied on Meta's AnimatedDrawings default TorchServe implementation. While excellent for enterprise-scale deployments, running a Java-based TorchServe instance locally on a consumer GPU (RTX 2050 4GB) introduced severe overhead.

This chapter details the architectural migrations and GPU optimizations implemented to achieve near real-time character processing, dropping cold-start inference times by over 90%.

## 2. The Bottleneck: TorchServe
The initial pipeline utilized TorchServe to host two models:
- **Humanoid Bounding Box Detector** (Mask R-CNN)
- **Pose Estimator** (ResNet50)

**The Problem:**
1. **Memory Bloat:** TorchServe (JVM) consumed ~1.5GB of RAM just to boot, leaving very little VRAM for the actual models on an RTX 2050.
2. **Cold Starts:** Booting the models into GPU memory on every request took **25-40 seconds**, destroying the interactive educational experience for children.
3. **Sequential Processing:** Background removal (via 
embg) and pose estimation were run sequentially, causing compounding latency.

## 3. The Solution: Native YOLOv8 + ONNXRuntime
We aggressively stripped out TorchServe and replaced the entire inference backend with a lightweight, asynchronous Python architecture.

### 3.1 Unifying the AI Pipeline
Instead of running two separate models for detection and pose estimation, we trained a custom **YOLOv8-Pose** model (est.pt) on children's drawings. YOLOv8 is capable of performing both bounding box detection AND keypoint estimation in a single, highly optimized pass.

### 3.2 VRAM Management (RTX 2050 4GB)
With limited VRAM, we had to carefully balance the memory allocation between the two heavy workloads:
1. **YOLOv8-Pose:** Loaded directly onto the GPU via PyTorch CUDA.
2. **Rembg (U-2-Net):** Background removal is intensive. To prevent CUDA Out-Of-Memory (OOM) errors, we forced 
embg to run via the ONNXRuntime-CPU execution provider, ensuring the GPU remained dedicated solely to pose estimation and physics rendering.

## 4. Performance Metrics

| Metric | Legacy Architecture (TorchServe) | Modern Architecture (YOLOv8 + Native) | Improvement |
| :--- | :--- | :--- | :--- |
| **Cold Start Time** | ~35.0 seconds | ~3.2 seconds | **91% Faster** |
| **Warm Inference Time**| ~4.5 seconds | ~0.8 seconds | **82% Faster** |
| **VRAM Consumption** | ~3.1 GB | ~1.4 GB | **55% Reduction**|
| **System RAM Usage** | ~2.5 GB (JVM overhead) | ~400 MB (Python) | **84% Reduction**|

## 5. Frontend Offloading (Fabric.js)
To further reduce server latency, we migrated heavy image pre-processing tasks to the client side. 
Using **Fabric.js** in the browser, all image scaling, cropping, and canvas interactions (such as users manually drawing missing limbs or dragging skeleton keypoints) are handled entirely by the user's local CPU/GPU. 

The server now only receives mathematically pure, pre-scaled JSON keypoints and optimized PNGs, drastically reducing the payload size over the network and allowing the Python backend to focus strictly on the ARAP (As-Rigid-As-Possible) physics rendering.

## 6. Conclusion
By bypassing enterprise middleware and building a native, hardware-aware pipeline, EduVision achieves production-grade inference speeds on consumer hardware. This ensures that young users stay engaged with the creative process rather than staring at loading screens.
