# Chapter 11: Comprehensive Developer Guide

Welcome to the EduVision technical developer guide. This document serves as the master blueprint for the entire repository. Whether you are a new team member onboarding or a maintainer debugging an issue, this guide explains what every major folder, file, and module in the system does and how they interconnect to build the final AI Storytelling pipeline.

---

## High-Level Architecture

The project is split into three tightly integrated components:
1. **EduVision UI (eduvision_ui/)**: A Node.js / Express web interface that acts as the frontend client for users to upload sketches, fix skeletons, and generate stories.
2. **Story Engine (story_engine/)**: A collection of Python scripts that handle the orchestration, asynchronous caching, and video compositing of stories.
3. **AnimatedDrawings Core (Actual repo (EDUVISION)/AnimatedDrawings/)**: A modified fork of Meta Research's Animated Drawings repository, heavily upgraded for performance, custom skeletal retargeting, and batch processing.

---

## 1. The Web Server (eduvision_ui/)

This directory houses the user-facing web application and the Express API server that bridges the web frontend to our Python machine learning backend.

### Key Files & Folders

* **server.js**
  * **Role:** The main Express backend. 
  * **Functionality:** Serves static HTML/JS files, provides REST endpoints for file uploads (/api/fixer/extract), triggers ML pipelines by spawning Python subprocesses, and serves generated story MP4s (/api/story/recent).
* **public/** *(Directory)*
  * Contains the static frontend web assets.
  * **index.html**: The landing page of the application.
  * **ixer.html**: The Character Fixer UI. Allows users to upload a drawing, view/edit the generated skeletal rig, adjust masking boundaries, and trigger animation preparation.
  * **story.html**: The Story Generator UI. Users assign their prepared characters (from sessionStorage) to predefined story slots (e.g., Rahim, Father, Grandma). Contains the "Recent Stories" video gallery.
* **uploads/** *(Directory)*
  * Temporary storage for incoming sketch images before they are passed to the ML engine.
* **package.json**
  * Node.js dependencies. Key modules: express (web server), multer (multipart file uploads).

---

## 2. The AI Orchestrator (story_engine/)

This directory contains the Python scripts that bridge the gap between a single character image and a fully rendered, multi-character .mp4 story.

### Key Files & Folders

* **prepare_character_api.py**
  * **Role:** The Entry Point for Character Uploads.
  * **Functionality:** Called by server.js when a user uploads a sketch. It runs the underlying Meta image-to-annotation script to generate masks and skeletons. To prevent the UI from freezing, it asynchronously spawns atch_animate.py in the background and immediately returns a success response to the Node server.
* **atch_animate.py**
  * **Role:** The Background Cache Generator.
  * **Functionality:** Runs silently in the background after a character is uploaded. It loops through required character motions (wave, walk, sleep) and pre-renders them as transparent GIFs into a cache. 
  * **Performance Hack:** This script intercepts the Meta engine configuration and injects end_frame_idx: 90. Truncating animations to ~3.75 seconds dropped cache generation time from 10+ minutes to ~50 seconds, saving massive amounts of CPU calculation time.
* **compose_story.py**
  * **Role:** The Video Compositor.
  * **Functionality:** Reads the pre-generated caches for each assigned character. It parses a JSON scene configuration to place characters on specific background X/Y coordinates. It extracts frames, composites them with Pillow, and uses FFMPEG to mux the final .mp4 with audio. It saves unique timestamped videos (e.g., ahims_story_1701384952.mp4) into the output/ directory.
* **output/** *(Directory)*
  * Stores the final rendered ahims_story_<timestamp>.mp4 files.
  * Contains scene_*/ subfolders (which are excluded from Git via .gitignore) used for temporary compositing frames.

---

## 3. The ML Core (Actual repo (EDUVISION)/AnimatedDrawings/)

This directory contains the core machine learning inference and rendering engine. It is a highly optimized fork of Meta's open-source AnimatedDrawings project.

### Key Files & Folders

* **examples/image_to_annotations.py**
  * **Role:** Skeleton & Mask Generation.
  * **Functionality:** Uses YOLOv8 (pose estimation) and OpenCV to separate the drawn character from the white background, generates a precise bounding box, and creates the .yaml skeletal node map.
* **nimated_drawings/render.py (and related MVC logic)**
  * **Role:** As-Rigid-As-Possible (ARAP) Mesh Deformation.
  * **Functionality:** Applies BVH motion capture data onto 2D meshes. This is the most computationally expensive part of the pipeline.
* **mixamo_custom.yaml (Retargeting Configs)**
  * **Role:** Bone Mapping.
  * **Functionality:** We implemented custom adapters to allow standard Mixamo BVH exports to work with the engine. It maps generic 3D bone structures to our specific 2D planar bone structure, gracefully ignoring missing Z-axis depth and absent finger joints.

---

## Summary of Technologies & Modules Used

### Node.js (Frontend / Backend)
- **Express.js**: Backend API routing and static file serving.
- **Multer**: Middleware for handling multipart/form-data image uploads.
- **Vanilla JS / HTML / CSS**: The frontend is built without heavy frameworks to maintain extreme speed and simplicity.

### Python (Machine Learning / Processing)
- **OpenCV (cv2)**: Image processing, masking, and contour detection.
- **Ultralytics (YOLOv8)**: AI-driven human pose estimation for skeletal mapping.
- **PyTorch**: Deep learning backend for YOLO and Meta's rendering functions.
- **Pillow (PIL)**: Frame-by-frame alpha compositing for final scene stitching.
- **MoviePy / FFMPEG**: Video encoding, concatenation, and audio muxing.
- **Subprocess**: Used extensively for inter-process communication (IPC) between Node.js and Python.

---

## Git & Version Control

To prevent repository bloat, we strictly maintain our .gitignore:
- Python caches (__pycache__) and Node modules (
ode_modules) are ignored.
- The story_engine/output/scene_*/ intermediate rendering frames are ignored.
- Only the essential scripts, HTML files, and documentation (like this textbook) are tracked in branches like main and storiesFS.

---

## The Complete Flow of Execution

To fully grasp the architecture, it is easiest to trace the path of a single user action from start to finish.

**Phase 1: Sketch Upload & Extraction**
1. User navigates to ixer.html and uploads a character drawing.
2. The UI sends a POST /api/fixer/extract request containing the image.
3. server.js receives the image and runs the YOLOv8 Python extraction script. The script identifies the human figure, separates it from the background, and infers initial skeletal joints, returning a .yaml config back to the UI.

**Phase 2: Human-in-the-Loop Correction**
4. The user adjusts the skeletal joints, bounding boxes, and masks directly on the web canvas to fix any AI errors.

**Phase 3: Background Caching**
5. The user hits "Process & Go to Engine", sending a POST /api/fixer/save request with the corrected joints.
6. server.js triggers prepare_character_api.py.
7. **Crucial Step:** To prevent the UI from freezing, prepare_character_api.py instantly replies {"success": true} to the web server. Simultaneously, it detaches and spawns atch_animate.py in the background.
8. While the user continues to browse the app, atch_animate.py takes ~50 seconds to run the ARAP mesh deformation on the character, pre-rendering transparent GIFs for all required animations (wave, walk, sleep) and saving them in characters/<id>/animations/.

**Phase 4: Story Composition**
9. The user navigates to story.html and assigns their customized characters to story slots (e.g., Slot 1 = Rahim, Slot 2 = Father).
10. Upon clicking "Generate", a POST /api/story/generate request triggers compose_story.py.
11. compose_story.py reads a master JSON scene layout. Instead of running expensive ML models, it simply grabs the transparent GIFs pre-cached in Phase 3. 
12. It overlays these GIFs onto static background images at specific X/Y coordinates, stretches the frame durations to perfectly match the length of the voiceover audio, and stitches the entire sequence into a final .mp4 using FFMPEG.

**Phase 5: Playback & Recent Stories**
13. compose_story.py saves the output as ahims_story_<timestamp>.mp4.
14. The UI receives the video URL, auto-plays the generated story, and hits GET /api/story/recent to seamlessly add the new video to the user's historical gallery.

---


## Deep Dive: The Mathematics of Animation

To fully comprehend the Animated Drawings engine, we must examine the rigorous mathematical models used to transform a flat, static pixel array into a fluid, articulated 2D mesh. The process is governed by topology, linear algebra, and numerical optimization.

### 1. Contour Extraction & Simplification
When a character is uploaded, YOLOv8 generates a raw binary mask (a boolean matrix where `1` represents the character and `0` represents the background). 

To animate this, we must extract the outer boundary. The engine uses the **Marching Squares algorithm** to find the boundary pixels. However, this raw boundary contains thousands of points, which is computationally infeasible for real-time deformation. 

To solve this, the engine applies the **Ramer-Douglas-Peucker (RDP) algorithm**. The RDP algorithm mathematically simplifies the curve by finding the point furthest from the line segment joining the curve's endpoints. If this orthogonal distance is less than a threshold $\epsilon$, the curve is discarded and approximated by the straight line. This reduces a 10,000-point contour to roughly 500 essential vertices, forming a closed polygon $P$.

### 2. Mesh Triangulation (Delaunay)
The polygon $P$ only defines the outline. To deform the character, the internal area must be split into a topological graph $G = (V, E)$ consisting of triangles.

The engine uses **Constrained Delaunay Triangulation (CDT)**. A Delaunay triangulation ensures that no vertex $v \in V$ is strictly inside the circumcircle of any triangle in the mesh. This mathematically maximizes the minimum angle of all triangles, preventing "skinny" or "sliver" triangles. Sliver triangles cause massive mathematical instability during deformation because their area approaches zero, causing matrix singularities when computing gradients.

### 3. Skeletal Binding (Skinning Weights)
Once the mesh $V$ and the skeleton joints $J$ are established, the engine must bind them. If a bone moves, which vertices should move with it? 

This is calculated using **Linear Blend Skinning (LBS)** and **Biharmonic Distances**. For every vertex $v_i$, a skinning weight $w_{i,j}$ is calculated for every bone $j$. The weights must satisfy the partition of unity: $\sum_j w_{i,j} = 1$.

The new position of a vertex $v'_i$ after bone transformations $T_j$ is given by:
`v'_i = Σ (w_{i,j} * T_j * v_i)`

To prevent vertices from moving unnaturally (e.g., the left hand moving when the right arm swings), weights are calculated using the Laplacian of the mesh graph, ensuring weight diffuses smoothly across the topology but stops sharply at topological gaps (like between two legs).

### 4. 3D to 2D Motion Retargeting (BVH Projection)
Mixamo `.bvh` files store motion capture data as 3D Euler angles $( \theta_x, \theta_y, \theta_z )$. Our characters are flat 2D drawings existing only on the $XY$ plane. 

To convert this, the engine first converts Euler angles into **Quaternions** $q = a + bi + cj + dk$ to prevent gimbal lock. It applies the 3D rotations to the 3D bone hierarchy. 
Then, an **Orthographic Projection Matrix** $P$ is applied to collapse the Z-axis:
```text
    | 1  0  0  0 |
P = | 0  1  0  0 |
    | 0  0  0  0 |
    | 0  0  0  1 |
```
This forces the motion onto a 2D plane. Our `mixamo_custom.yaml` acts as a topological map, mapping the projected 3D coordinates onto our specific 2D joint hierarchy.

### 5. ARAP Deformation (The Computational Bottleneck)
This is the mathematical core of the engine. When the bones move, the LBS (Linear Blend Skinning) algorithm described above causes the mesh to collapse at the joints (the "candy wrapper" effect). 

To fix this, the engine uses the **As-Rigid-As-Possible (ARAP)** deformation algorithm. ARAP ensures that every individual triangle in the mesh undergoes a pure rigid transformation (rotation and translation) without stretching or shearing.

Mathematically, ARAP seeks to find the new vertex positions $V'$ that minimize the total deformation energy $E$:

`E(V') = Σ_i Σ_{j ∈ N(i)} w_{ij} || (v'_i - v'_j) - R_i(v_i - v_j) ||^2`

Where:
- $N(i)$ are the neighbor vertices of $v_i$.
- $w_{ij}$ are cotangent weights derived from the mesh Laplacian.
- $R_i$ is the optimal 2D rotation matrix for the triangle.

**How it is solved:**
This is a highly non-linear optimization problem, solved iteratively using the **Local-Global alternating approach**:
1. **Local Step:** Fix the vertex positions $V'$, and find the optimal rotations $R_i$ for every triangle using Singular Value Decomposition (SVD).
2. **Global Step:** Fix the rotations $R_i$, and solve for the new vertex positions $V'$. By taking the partial derivative of the energy function and setting it to zero, the problem reduces to a sparse linear system:
   `L * V' = b`
   Where $L$ is the sparse Laplacian matrix of the mesh.

The engine uses **Cholesky Factorization** to solve this linear system. Because this massive matrix calculation and SVD must happen **30 times per second (for every single frame)**, ARAP is intensely CPU-bound. This mathematical complexity is exactly why our `end_frame_idx: 90` truncation hack was absolutely necessary to bring render times down from 10+ minutes to ~50 seconds.

### 6. Frame Fusing & Alpha Blending
Once the ARAP algorithm outputs the deformed vertices $V'$ for a given frame, the engine maps the original pixel colors (UV mapping) onto the deformed mesh using OpenGL, rendering the character against a transparent background (Alpha = 0).

In `compose_story.py`, we take these transparent frames and fuse them onto the static story background. This fusion relies on the **Porter-Duff "Over" composite operator** (Alpha Blending). 

For every pixel, the mathematical blend between the character pixel (Source) and the background pixel (Destination) is calculated as:
`C_out = (C_src * A_src) + (C_dst * A_dst * (1 - A_src))`
`A_out = A_src + A_dst * (1 - A_src)`

Where $C$ represents the RGB color vector and $A$ represents the Alpha channel (opacity from 0.0 to 1.0).

By applying this matrix calculation across all 1920x1080 pixels for hundreds of frames using Python's `Pillow` (PIL) library, we stitch the moving character seamlessly into the scene. Finally, `FFMPEG` compresses this raw pixel data using Discrete Cosine Transforms (DCT) in the H.264 codec, fusing the `.mp3` audio track to output the final `.mp4` video.
