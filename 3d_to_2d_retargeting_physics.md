# The Mathematics of 3D-to-2D Motion Retargeting (Deep Dive)

The process of driving a flat, 2D character drawing using 3D motion capture data (BVH) represents a complex topological challenge. This document outlines the rigorous mathematical pipeline, with exact code references to the `AnimatedDrawings` codebase, detailing how 3D Euler transformations are translated into 2D mesh deformations using PCA, Depth Drivers, and ARAP.

## 1. The Retarget Configuration Mapping
The entire pipeline is governed by the retargeting config file, which translates the complex 3D Mixamo/FAIR skeleton (50+ joints) into the 16-joint 2D stick figure.

**File Reference:** [`examples/config/retarget/fair1_ppf.yaml`](file:///home/champion/Major%20Project%20-%20MVP/Actual%20repo%20%28EDUVISION%29/AnimatedDrawings/examples/config/retarget/fair1_ppf.yaml)

In this file, the `char_joint_bvh_joints_mapping` (Lines 84-114) explicitly defines how 2D bones are driven by 3D bones. For example, the 2D `left_elbow` angle is calculated by looking at the angle between the 3D `LeftArm` and `LeftForeArm`.

## 2. The PCA Projection Plane (Solving Foreshortening)
If a 3D character punches directly forward at the camera, orthographic projection causes the arm's length to shrink to zero on screen. To prevent the physics mesh from crushing inward, the engine builds a custom "invisible plane" to project the limb's motion onto.

**Code Reference:** [`_determine_projection_plane_normal` in `retargeter.py`](file:///home/champion/Major%20Project%20-%20MVP/Actual%20repo%20%28EDUVISION%29/AnimatedDrawings/animated_drawings/model/retargeter.py#L155-L210)

1. The YAML config defines a kinematic chain (e.g., "Upper Limbs") and assigns it `method: pca`.
2. The engine collects the 3D coordinates of all joints in that chain across all frames into a massive array (`joints_points`).
3. It runs **Principal Component Analysis (PCA)** on these points via scikit-learn:
```python
# Lines 194-197 in retargeter.py
pca = PCA()
pca.fit(joints_points)
pc3: npt.NDArray[np.float32] = pca.components_[2] 
```
4. `pca.components_[2]` represents the 3rd Principal Component (the eigenvector with the *least* variance). This vector mathematically represents the **normal (perpendicular line)** to the 2D plane where the arm swings the widest.
5. The engine checks if this normal is closer to the global X-axis or Z-axis (Lines 200-208) and snaps it to the closest one.
6. **The Result:** The 3D motion is orthogonally flattened onto this plane. A forward punch in 3D is mathematically "unrolled" into a sideways swing in 2D, preserving the 2D arm's length perfectly and preventing mesh collapse.

## 3. Z-Index Layering (Depth Drivers)
Because PCA flattens the 3D depth of the motion, the renderer needs a new way to calculate occlusion (e.g., if a hand moves across a chest, does it render in front or behind?).

**Code Reference:** [`_compute_depths` in `retargeter.py`](file:///home/champion/Major%20Project%20-%20MVP/Actual%20repo%20%28EDUVISION%29/AnimatedDrawings/animated_drawings/model/retargeter.py#L211-L240)

The config file defines `bvh_depth_drivers` (e.g., `LeftHand` drives the depth of the 2D `left_arm`).
During initialization, the engine calculates the orthogonal distance of these driver joints to the projection plane for every frame:
```python
# Lines 229-233 in retargeter.py
if np.array_equal(projection_plane_normal, x_axis):
    joint_depths = joint_xyz[:, 0]
elif np.array_equal(projection_plane_normal, z_axis):
    joint_depths = joint_xyz[:, 2]
```
When rendering, the View controller sorts the 2D mesh layers based on these depths. If the original 3D Z-depth of `LeftHand` is greater than `Spine`, it renders the arm triangles *after* (on top of) the torso triangles.

## 4. The ARAP Physics Solver
Once the 2D joints have their flattened, unrolled coordinates, the pixels of the drawing must be bent to match.

**Code Reference:** [`ARAP` class in `arap.py`](file:///home/champion/Major%20Project%20-%20MVP/Actual%20repo%20%28EDUVISION%29/AnimatedDrawings/animated_drawings/model/arap.py)

1. **Delaunay Triangulation:** The character's mask is turned into a web of triangles.
2. **As-Rigid-As-Possible (ARAP):** This is a non-linear optimization solver. Its mathematical goal is to *minimize the distortion* of every triangle in the mesh.
3. As the skeleton joints move, they act as "control points". The ARAP math forces the surrounding triangles to rotate and translate to follow the joints, but heavily penalizes them for stretching or shearing.
4. This results in the drawing bending exactly like rubber at the joints (elbows/knees) while remaining rigid across the bones (forearms/shins).
