# Chapter 4: 2D Graphics Geometry & Physics Deformations

Once a drawing's joints are detected, the graphics engine takes over. In this chapter, we explore the mathematics and computational geometry required to build a 2D mesh, rig it with a skeleton, project 3D animations, and solve deformations in real-time.

---

## 1. Marching Squares (Contour Tracking)

To animate a character, we must isolate its body from the white paper. The segmentation step output is a binary mask (`mask.png` where the character is white and the background is black).

The **Marching Squares** algorithm divides the mask image grid into $2 \times 2$ pixel cells. It evaluates the corners of each cell, determines a lookup index from the 16 possible black-and-white corner configurations, and draws contour lines. Repeating this across the image extracts the precise 2D outer boundary points of the character drawing.

---

## 2. Delaunay Triangulation (Mesh Creation)

Once we have the boundary points, we need to turn the flat drawing into a flexible sheet. We do this by subdividing the character's interior body shape into a mesh of triangles.

The engine runs **Delaunay Triangulation**. A triangulation is Delaunay if the circumcircle of any triangle contains no other vertices in its interior:

```
      A
     / \
    /   \
   B-----C
    \   /
     \ /
      D
  (The circle passing through A, B, C contains no other points)
```

#### Why Delaunay?
This mathematical constraint prevents the creation of extremely thin, skinny triangles. Skinny triangles deform poorly under rotation and cause visual stretching artifacts (texture shearing). Delaunay ensures triangles are as close to equilateral as possible.

---

## 3. Barycentric Coordinates (Skeleton Rigging)

Since the joints detected by YOLO do not land exactly on the mesh vertices, we must bind each joint to the interior of a specific triangle. We use **Barycentric Coordinates** to express the joint position $\vec{P}$ as a weighted average of the triangle's vertices $\vec{A}$, $\vec{B}$, and $\vec{C}$:

$$\vec{P} = \alpha \vec{A} + \beta \vec{B} + \gamma \vec{C}$$

Subject to the constraint:
$$\alpha + \beta + \gamma = 1$$

* The weights $(\alpha, \beta, \gamma)$ represent the coordinate location of the joint.
* As the animation runs, the joints move. The graphics engine uses these fixed weights to pull the triangle vertices $(\vec{A}, \vec{B}, \vec{C})$ along with the joints, dynamically warping the mesh.

---

## 4. PCA Motion Projector (3D-to-2D Retargeting)

The animations we use (Mixamo motion clips) are recorded by actors in 3D space. To project this motion onto our flat 2D drawing without losing the essence of the performance, we run **Principal Component Analysis (PCA)**:

1. The solver records the 3D joint coordinate trajectories over the duration of the animation.
2. It calculates the covariance matrix of the motion vectors.
3. The eigenvalues of this matrix identify the principal directions. The eigenvector corresponding to the smallest eigenvalue is the normal vector of the plane where the motion has the *least* variance.
4. The engine projects the 3D joints orthogonally onto the remaining 2D plane, flattening the animation naturally relative to the character's front-facing profile.

---

## 5. As-Rig-As-Possible (ARAP) Shape Deformation

If you rotate a character's wrist, the forearm mesh must follow, but it shouldn't stretch out of shape. The engine uses the **As-Rig-As-Possible (ARAP)** algorithm to solve this:

* **Energy Minimization:** The solver defines a local deformation energy for each triangle. If a triangle is stretched or sheared, the energy increases. 
* **The Solver:** At 30 FPS, the system solves a global system of linear equations to find the vertex coordinates that minimize this deformation energy. 

This creates a realistic "rubber-sheet" physics effect: the limbs stretch slightly and bend smoothly at the joints while keeping the bones (forearm, shins) rigid, mimicking real skeletal anatomy.
