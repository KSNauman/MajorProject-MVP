# 2. Mathematical Foundations and Proofs

This document gives the mathematics behind every stage of EduVision and, where a property can be proved, a short proof. Each section names the file that implements it, so every statement can be checked against the code.

**Notation.** Vectors are bold or written with indices; $\|\cdot\|$ is the Euclidean norm; $[\cdot]$ is 1 if the condition holds and 0 otherwise.

| § | Topic | Implemented in |
|---|---|---|
| 2.1 | Keypoint format and 17→16 skeleton mapping | `examples/image_to_annotations.py` (`_build_skeleton`) |
| 2.2 | Pose model: loss, OKS and mAP | Ultralytics YOLOv8-Pose, `best.pt` |
| 2.3 | Padding augmentation | Training notebook (textbook ch. 6) |
| 2.4 | Hybrid segmentation | `image_to_annotations.py` (`segment`) |
| 2.5 | Mesh construction | `animated_drawing.py` (`_generate_mesh`) |
| 2.6 | Pins and barycentric binding | `arap.py` (`_xy_to_barycentric_coords`) |
| 2.7 | ARAP deformation and why factorising once is enough | `arap.py` |
| 2.8 | Motion retargeting and PCA projection | `retargeter.py` |
| 2.9 | The neck-joint fix ("sinking head") | `animate_drawing_service.py` |
| 2.10 | The 90-frame cap: time and playback speed | `batch_animate.py` |
| 2.11 | Story timeline: no drift between picture and narration | `compose_story.py` |
| 2.12 | Weighted k-NN digit recogniser | `ml-digit-recognizer.js` |
| 2.13 | Game scoring formulas | `activities/*.html` |
| 2.14 | Security: JWT, bcrypt and launch-token binding | `platform/api/routes/*.js` |
| 2.15 | Upload queue timing | `story_engine/ai_server.py` |

The texture-preservation proof (the animation only moves the child's own pixels) is in [04_WHY_NO_GENERATIVE_AI_APIS.md](04_WHY_NO_GENERATIVE_AI_APIS.md) §4.5.

---

## 2.1 Keypoints and the 17 → 16 Skeleton Mapping

The pose model outputs the 17 COCO keypoints $k_0, \dots, k_{16} \in \mathbb{R}^2$ (0 nose, 5/6 shoulders, 7/8 elbows, 9/10 wrists, 11/12 hips, 13/14 knees, 15/16 ankles), each with a confidence $c_i \in [0, 1]$.

AnimatedDrawings needs 16 joints arranged as a tree. `_build_skeleton` defines:

$$\text{root} = \text{hip} = \tfrac12(k_{11} + k_{12}), \qquad \text{torso} = \tfrac12(k_5 + k_6), \qquad \text{neck} = k_0$$

and copies the limb points directly (right shoulder $= k_6$, right elbow $= k_8$, …). Parents form the tree: root → hip → torso → neck; torso → each shoulder → elbow → hand; root → each hip → knee → foot.

**Property (the skeleton is a valid tree).** There are 16 joints and 15 parent links. Every joint except `root` has exactly one parent that appears earlier in the list, so the graph is connected with $|E| = |V| - 1$ edges. It is therefore a tree with no cycles, which the retargeter needs in order to walk it from the root.

**Why the neck is taken from the nose.** The COCO set has no neck keypoint. Using the nose puts the "neck" joint **inside the head**, so the head is a pinned handle. Section 2.9 shows why that matters.

---

## 2.2 The Pose Model: What It Optimises and How It Is Scored

`best.pt` is a YOLOv8n-pose network with **3,295,470 parameters**, whose output is one class, "humanoid", with 17 keypoints of 3 values each (`kpt_shape [17, 3]`). Its training settings are stored inside the file (`docs/evidence/pose_model_training.json`).

### 2.2.1 Training loss

$$\mathcal{L} = \lambda_{box}\mathcal{L}_{CIoU} + \lambda_{dfl}\mathcal{L}_{DFL} + \lambda_{cls}\mathcal{L}_{BCE} + \lambda_{pose}\mathcal{L}_{OKS} + \lambda_{kobj}\mathcal{L}_{kobj}$$

The weights used are $\lambda_{box} = 7.5$, $\lambda_{dfl} = 1.5$, $\lambda_{cls} = 0.5$, $\lambda_{pose} = 12.0$ and $\lambda_{kobj} = 1.0$. The large $\lambda_{pose}$ says keypoint accuracy matters most to this project.

- **CIoU box loss:** $1 - \text{IoU} + \frac{\rho^2(b, b^*)}{c^2} + \alpha v$, where $\rho$ is the distance between box centres, $c$ is the diagonal of the smallest enclosing box, and $v$ penalises a different aspect ratio.
- **OKS keypoint loss:** $1 - \text{OKS}$ (defined below).
- **kobj:** binary cross-entropy for "is this keypoint visible".

### 2.2.2 Object Keypoint Similarity (OKS)

For one predicted figure with keypoints $\hat k_i$, true keypoints $k_i$, visibility $v_i$, object area $s$ and per-joint constants $\kappa_i$:

$$\text{OKS} = \frac{\sum_i \exp\!\left(-\dfrac{\|\hat k_i - k_i\|^2}{2 s^2 \kappa_i^2}\right)[v_i > 0]}{\sum_i [v_i > 0]}$$

**Properties.**
- $0 \le \text{OKS} \le 1$, because each term is in $(0, 1]$ and the result is an average.
- $\text{OKS} = 1$ exactly when every visible keypoint is perfect.
- It does not depend on image size, because the error is divided by the object's own scale $s$. A 10 px error on a small drawing counts more than on a large one, which is fair for drawings of any size.

### 2.2.3 mAP

A prediction is a true positive at threshold $t$ if its OKS (or box IoU) is at least $t$. Average Precision (AP) is the area under the precision–recall curve. **mAP50** uses $t = 0.5$. **mAP50-95** averages AP over $t \in \{0.50, 0.55, \dots, 0.95\}$, so it rewards precise keypoints, not just roughly correct ones.

Our measured values are in [03_MODEL_METRICS.md](03_MODEL_METRICS.md).

---

## 2.3 Padding Augmentation: Why It Helps

**Problem observed** (textbook chapter 6): the first model predicted almost the same "A-pose" for every drawing. In the training images the figure filled the frame, so the network could lower its loss by learning a fixed *average* skeleton at a fixed position, instead of looking at the drawing.

**Method.** Each training drawing is shrunk by a random factor $\sigma$ and pasted at a random position $(t_x, t_y)$ on a larger blank canvas. Its labels move with it: $k_i \mapsto \sigma k_i + t$.

**Claim.** After augmentation, a model that predicts a fixed skeleton at a fixed place has much higher expected loss, so the optimiser is pushed to read the drawing.

**Argument.** Let $\hat k$ be any fixed prediction that ignores the image. With $t$ spread uniformly over a region of width $W$, the expected squared error of keypoint $i$ is at least the variance of its true position:

$$\mathbb{E}\big[\|\hat k_i - (\sigma k_i + t)\|^2\big] \ \ge\ \operatorname{Var}(\sigma k_i + t) \ \ge\ \operatorname{Var}(t_x) + \operatorname{Var}(t_y) = 2\cdot\frac{W^2}{12}$$

This uses $\mathbb{E}\|X - c\|^2 \ge \operatorname{Var}(X)$ for any constant $c$, and the fact that $t$ is independent of the drawing. Without padding, $W \approx 0$ and the bound is close to 0, so the "average skeleton" shortcut is cheap. With padding, the bound grows with $W^2$, so the shortcut becomes expensive. ∎

The training run of the final model also used Ultralytics' own augmentations: `translate 0.1`, `scale 0.3`, `degrees 5`, `fliplr 0.5`, `mosaic 0.5` and `erasing 0.4`. Padding augmentation adds a **much wider** spread of positions and scales than `translate 0.1`.

> **Honest status:** the final checkpoint stores its training settings, but not a side-by-side run *without* padding. So the benefit is argued here and seen in practice (chapter 6), but not measured as an ablation. See [07_CRITIQUE_RESPONSE.md](07_CRITIQUE_RESPONSE.md).

---

## 2.4 Hybrid Segmentation

`segment()` turns a cropped drawing into a binary mask $M$ (a set of pixels). Let $A$ be the **AI silhouette** from rembg (U²-Net) and $P$ the **pen-line mask**.

**Step 1: pen lines (adaptive Gaussian threshold).** For each pixel $x$, with $g$ the darkest colour channel (`np.min(img, axis=2)`, so coloured strokes count as ink):

$$P_0(x) = \big[\, g(x) < \mu_G(x) - C \,\big], \qquad \mu_G(x) = \sum_{y \in N_{115}(x)} G(x - y)\, g(y)$$

Here $N_{115}$ is a 115 × 115 window, $G$ is a normalised Gaussian, and $C = 8$. Comparing with the **local** mean makes it robust to uneven lighting in phone photos, which a single global threshold is not.

**Step 2: morphology.** $P = \delta^2(\phi^2(P_0))$: two closings, then two dilations, with a 3 × 3 square. Closing $\phi = \varepsilon \circ \delta$ joins gaps of about 2 px; dilation $\delta$ thickens strokes.

**Step 3: intersection.** $M_1 = P \cap A$.

**Property 1 (no new pixels).** $M_1 \subseteq P$ and $M_1 \subseteq A$. A pixel survives only if it is **both** ink and part of the figure, which removes paper texture (in $P$ but not $A$) and shadows (in $A$ but not $P$).

**Step 4: thin-drawing rescue.** If rembg kept less than 90% of the pen pixels ($|M_1| / |P| < 0.9$), the drawing is treated as thin line art. Let $\mathcal{C}$ be the connected components of $P$, ignoring a border band of width $\max(3, 0.015 \cdot \text{size})$. Then

$$M_2 = M_1 \ \cup \bigcup_{C \in \mathcal{C},\ C \cap M_1 \ne \emptyset} C$$

**Property 2 (whole strokes only).** The only pixels added are entire pen strokes that already touch the kept figure. A stray mark not connected to the figure is never added. The border band stops the edge of the paper in a photo from counting as a stroke.

**Steps 5–7: clean-up.**
- A flood fill from the image border removes regions connected to the border.
- `skimage.measure.find_contours` keeps the **largest** closed contour.
- `binary_fill_holes` fills its inside.

**Property 3 (one solid shape).** The final mask is one region with no holes: one outer boundary filled in completely. This is what the mesh step (§2.5) needs.

> **Trade-off (raised by both reviewers):** keeping only the largest contour removes a body part drawn **detached** from the body, such as a floating hand. The Fixer's "draw missing limbs" tool exists for exactly that case.

---

## 2.5 Mesh Construction

`_generate_mesh` (in `animated_drawing.py`):
1. **Outline:** marching squares (`find_contours(mask, 128)`) traces the mask edge as a polygon; `approximate_polygon(tolerance=0.25)` removes nearly collinear points.
2. **Inside points:** a 40 × 40 grid over the image; only points inside the outline are kept (`shapely.contains_xy`).
3. **Triangulation:** Delaunay triangulation of outline plus inside points.
4. **Filtering:** keep a triangle only if its centroid lies inside the outline.

**Property (Delaunay).** No point lies inside the circumcircle of any triangle. Among all triangulations of the same points, this one **maximises the smallest angle**, so it avoids long, thin triangles that would bend badly under ARAP.

**Property (the speed-up gives exactly the same mesh).** The faster version (chapter 14) replaced a Python loop of `polygon.contains(Point(x, y))` calls with one vectorised `shapely.contains_xy(polygon, points)` call. Both evaluate the same predicate on the same points in the same order. The boolean result is therefore identical, so the vertex set and triangles are identical. This was also checked exactly on all six characters.

---

## 2.6 Pins and Barycentric Binding

Each skeleton joint $j$ is a **pin** (control handle) attached to the mesh. `_xy_to_barycentric_coords` finds the triangle $(a, b, c)$ containing $j$ and solves:

$$j = \alpha a + \beta b + \gamma c, \qquad \alpha + \beta + \gamma = 1$$

Using signed areas: $\alpha = \frac{\det(b - j,\, c - j)}{\det(b - a,\, c - a)}$, and likewise for $\beta, \gamma$.

**Property.** $j$ is inside the triangle if and only if $\alpha, \beta, \gamma \ge 0$. If a joint lies outside every triangle (for example, a hand joint placed just outside a thin arm), the code snaps it to the **nearest vertex** with weight 1. This is the source of the log message "point … was outside mesh; automatically snapped to nearest vertex".

---

## 2.7 ARAP Deformation (As-Rigid-As-Possible)

The engine implements Igarashi & Igarashi, *Implementing As-Rigid-As-Possible Shape Manipulation and Surface Flattening*, JGT 14(1), 2009 (an implementation of Igarashi, Moscovich & Hughes, SIGGRAPH 2005).

**Inputs:** rest vertex positions $v_i$, mesh edges $E$, pin positions $p_h$ (the posed joints for this frame). **Output:** new vertex positions $v_i'$.

**Step 1 (similarity solve).** Find $v'$ that keeps each edge's shape up to a rotation **and** a uniform scale, in the least-squares sense, with the pins weighted by $w$:

$$\min_{v'} \ \sum_{(i,j) \in E} \big\| (v_j' - v_i') - T_{ij}(v_j - v_i) \big\|^2 + w^2 \sum_h \big\| B_h v' - p_h \big\|^2$$

Here $T_{ij} = \begin{pmatrix} c & s \\ -s & c \end{pmatrix}$ is a rotation-plus-scale written linearly in terms of the neighbouring vertices (matrix $G$ in the code), and $B_h$ holds the barycentric weights of pin $h$. This is a **linear** least-squares problem $\min \|A_1 x - b_1\|^2$, solved through the normal equations $A_1^\top A_1 x = A_1^\top b_1$.

**Step 2 (remove the scale).** From step 1, each edge gets $(c, s)$. The code normalises them, $c \leftarrow c / \sqrt{c^2 + s^2}$ and $s \leftarrow s / \sqrt{c^2 + s^2}$, which turns the similarity into a **pure rotation** $R_{ij}$.

**Step 3 (rigid solve).** Solve again with the rotated rest edges as targets:

$$\min_{v'} \ \sum_{(i,j) \in E} \big\| (v_j' - v_i') - R_{ij}(v_j - v_i) \big\|^2 + w^2 \sum_h \big\| B_h v' - p_h \big\|^2$$

The $x$ and $y$ coordinates separate, giving two solves with the same matrix $A_2^\top A_2$.

**Why this looks natural.** Rotation is free but stretching is penalised, so a forearm swings without getting longer: "elbows bend, forearms stay rigid."

### Proposition (factorising once is enough)

The matrices $A_1^\top A_1$ and $A_2^\top A_2$ depend only on the **mesh** (vertices, edges) and on **which triangle each pin is in**. They do not depend on where the pins move. Only the right-hand sides $b_1, b_2$ change from frame to frame.

**Proof.** In the code, $A_1$ and $A_2$ are built once in `__init__` from `edge_vectors`, `G` and the pins' barycentric rows. In `solve()`, the new pin positions `pins_xy` appear only in `b1` and `b2`. ∎

**Consequence.**
- The sparse LU factorisation `spla.factorized(...)` is computed **once per character**.
- Each frame then needs only forward and back substitution.
- For a mesh with $n$ vertices and fill-in $\phi$, this costs $O(\phi)$ per frame instead of a full sparse factorisation each time.
- Over $F$ frames, total solve work drops from $F \cdot (\text{factor} + \text{solve})$ to $\text{factor} + F \cdot \text{solve}$.
- Measured effect (chapter 12): one 90-frame wave went from 6.148 s to 4.403 s.

**Is the system solvable?** $A^\top A$ is positive definite if and only if $A$ has full column rank. The edge terms alone fix the shape only up to a translation (and, in step 1, a rotation and scale). With **at least two pins at different positions**, these remaining freedoms are removed, so $A$ has full column rank and the solution is unique. Our skeleton always has 16 pins.

---

## 2.8 Motion Retargeting and the PCA Projection

BVH motion files hold a 3D skeleton. A drawing is 2D. `retargeter.py` projects each body-part group (upper limbs, lower limbs, trunk) onto a plane, chosen by the retarget config (`fair1_ppf.yaml` or `mixamo_custom.yaml`):
- **frontal:** project onto the plane facing the camera (normal = $x$ axis);
- **sagittal:** project onto the side plane (normal = $z$ axis);
- **pca:** choose between the two **using the data**.

**PCA rule (the code's exact behaviour).** Gather all 3D positions $X \in \mathbb{R}^{m \times 3}$ of the group's joints over every frame, and compute the principal components $u_1, u_2, u_3$: the eigenvectors of the covariance $\Sigma = \frac{1}{m}(X - \bar X)^\top (X - \bar X)$, with eigenvalues $\lambda_1 \ge \lambda_2 \ge \lambda_3$. Take $u_3$, the direction in which the joints move **least**. Then use the $x$ axis as the plane normal if $|\cos\angle(u_3, x)| > |\cos\angle(u_3, z)|$, otherwise the $z$ axis.

**Theorem (the PCA plane keeps the most motion).** Among all planes through the mean, the one with normal $u_3$ keeps the largest share of the motion's variance, namely $\lambda_1 + \lambda_2$.

**Proof.** Projecting onto the plane with unit normal $n$ removes the variance $n^\top \Sigma n$ along $n$ and keeps $\operatorname{tr}\Sigma - n^\top \Sigma n$. By the Rayleigh–Ritz theorem, $n^\top \Sigma n$ is smallest, equal to $\lambda_3$, at $n = u_3$. So the kept variance $\operatorname{tr}\Sigma - \lambda_3 = \lambda_1 + \lambda_2$ is the largest possible. ∎

**Why it matters.** A limb pointing towards the camera has almost no length in the frontal view and seems to vanish. Choosing the plane where the movement is widest avoids this. The code then **snaps** $u_3$ to the nearer of $x$ or $z$, so the character still faces front or side rather than an odd angle.

After projection, each character bone keeps **its own length** from the drawing and takes the **2D angle** of the matching BVH bone. So a short-armed drawing moves like the motion-capture actor without its arms stretching.

---

## 2.9 The Neck-Joint Fix ("Sinking Head")

**Bug.** In the Activity Center, characters' heads folded down into their shoulders. The template skeleton (Route C, [05_ACTIVITY_CENTER.md](05_ACTIVITY_CENTER.md)) put the **neck joint at the chin**, so **no pin was inside the head**.

**Why that causes it.** Let $H$ be the head's mesh vertices. If no pin lies in $H$, the ARAP energy for $H$'s edges can be made zero by moving $H$ rigidly. The head is then fixed only through the narrow neck region that joins it to the pinned torso. Rotating the head about the neck changes the energy only a little, and the least-squares solution can choose a rotation that folds the head downwards, with nothing to resist it.

**Fix.** Put the neck pin **inside** the head, at 13% of the mask height from the top (the middle of a typical head). A pin $B_h v' = p_h$ with weight $w$ adds $w^2 \|B_h v' - p_h\|^2$ to the energy, so the head must follow the neck joint's motion, and the free rotation disappears.

The story pipeline never had this problem, because it uses the nose keypoint (§2.1), which is already inside the head.

**Checked:** frames were rendered before and after the fix (same drawing, same motion), and the heads stay upright after it.

---

## 2.10 The 90-Frame Cap: Time and Playback Speed

`batch_animate.py` sets `end_frame_idx: 90`.

**Time model.** Rendering one motion takes approximately

$$T(F) \approx T_0 + F \cdot t_f$$

where $T_0$ is setup (mesh, ARAP factorisation, OpenGL) and $t_f$ is the time per frame. Capping $F$ cuts the second term in proportion to $F$, not the first.

**Measured** (warm engine, `benchmarks.json`): the wave took 2.31 s for 90 frames and 9.23 s for all 839. Solving the two equations gives

$$t_f = \frac{9.23 - 2.31}{839 - 90} \approx 9.2\ \text{ms per frame}, \qquad T_0 \approx 2.31 - 90 \times 0.0092 \approx 1.5\ \text{s}$$

The jump motion predicts the same per-frame cost independently: $(3.83 - 2.39)/(250 - 90) \approx 9.0$ ms. So the linear model fits. The cap saves about $(N - 90) \times 9.2$ ms per motion, and it saves the much larger file too: 13.8 MB versus 1.5 MB for the wave GIF.

**How much motion is kept.** A BVH file has a frame time $\Delta$. The 90 frames cover $90\Delta$ seconds of the recorded motion:

| Motion | BVH frames | $\Delta$ | Kept by the cap |
|---|---|---|---|
| idle, jump, sleep, opening, walk in circle | 250 | 0.0333 s | $90 \times 0.0333 = 3.0$ s of 8.3 s (36%) |
| wave (`wave_hello.bvh`) | 839 | 0.00834 s | $90 \times 0.00834 = 0.75$ s of 7.0 s (11%) |

**Playback speed.** A GIF frame cannot be shorter than 20 ms (the engine's own rule: "Specified duration of .gif is too low, replacing with 20"). The wave asks for 8.34 ms per frame, gets 20 ms, and so plays $20 / 8.34 = 2.4\times$ slower than recorded. The 250-frame motions ask for 33.3 ms, so they play at the correct speed.

**Fix (future work):** sample every $k$-th frame instead of the first 90. With $k = \lceil N/90 \rceil$, the whole motion is covered with the same number of frames, so the same render time.

---

## 2.11 Story Timeline: No Drift Between Picture and Narration

`compose_story.py` writes scene $s$ (from $t_s$ to $t_{s+1}$ seconds) as

$$n_s = \operatorname{round}(24\, t_{s+1}) - \operatorname{round}(24\, t_s) \quad \text{frames at 24 fps.}$$

**Claim.** The video's total frame count is $\operatorname{round}(24\, t_{end}) - \operatorname{round}(24\, t_{start})$, so the picture never drifts from the narration by more than half a frame (about 21 ms), however many scenes there are.

**Proof.** The sum telescopes:

$$\sum_{s} n_s = \sum_s \big[\operatorname{round}(24 t_{s+1}) - \operatorname{round}(24 t_s)\big] = \operatorname{round}(24\, t_{end}) - \operatorname{round}(24\, t_{start})$$

Each scene boundary $t_s$ is placed at frame $\operatorname{round}(24 t_s)$, which is within $\tfrac{1}{2}$ frame of its true time. The rounding errors do not add up from scene to scene. ∎

The older method cut each scene's **length** down to a whole number of frames separately (`int(duration * FPS)`), losing up to one frame per scene. Those losses **accumulated**: up to 9 frames (0.375 s) over 9 scenes.

---

## 2.12 Weighted k-NN Digit Recogniser

**Features.** A written digit becomes $x \in [0, 16]^{64}$: an 8 × 8 image of ink amounts, $f = 16(255 - \text{gray})/255$ (§5.3 in the Activity Center document).

**Decision.** With training pairs $(x_n, y_n)$ for $n = 1, \dots, 1797$, find the $k = 3$ nearest, $\mathcal{N}_3(x)$, by Euclidean distance $d_n = \|x - x_n\|$. Each digit $c$ gets a vote

$$V_c(x) = \sum_{n \in \mathcal{N}_3(x)} \frac{[y_n = c]}{d_n + 10^{-5}}$$

The prediction is $\hat y = \arg\max_c V_c$, and the confidence shown is $V_{\hat y} / \sum_c V_c$.

**Properties.**
1. **An exact match wins.** If the input equals a training sample ($d_n = 0$), that neighbour's weight is $10^5$. The training vectors are whole numbers from 0 to 16, so two *different* training samples are at least distance 1 apart, and the other neighbours each have weight below 1. A training sample therefore always gets its own label back, which is a quick self-check of the code.
2. **The confidence is a proper share:** $0 < V_{\hat y} / \sum_c V_c \le 1$, and it equals 1 when all 3 neighbours agree.
3. **Theory.** Cover & Hart (1967) proved that, as the amount of data grows, the 1-NN error rate is at most **twice the Bayes (best possible) error**. This is an asymptotic result; with 1,797 samples it is a guide, not a guarantee, so we **measured** the accuracy instead ([03_MODEL_METRICS.md](03_MODEL_METRICS.md) §3.4).
4. **Why $k = 3$.** It is odd, so two neighbours always outvote one. The 10-fold comparison of $k \in \{1, 3, 5, 7\}$ is reported in 03.

**Cost.** One prediction costs $1797 \times 64 \approx 1.15 \times 10^5$ multiply-adds plus a sort, which takes well under a millisecond in a browser. That is why it runs on the child's device and not on a server.

---

## 2.13 Game Scoring Formulas

| Game | Score | Accuracy and stars |
|---|---|---|
| Count & Play | $S = \max(0,\ 20c - 2m)$, applied after each answer | $a = \frac{R}{R + m}$ with $R = 5$ rounds; 3★ if $a \ge 0.8$, 2★ if $a \ge 0.6$, else 1★ |
| Jigsaw | $+25$ per correct piece, $-2$ per mistake, never below 0 | $a = \frac{P}{P + m}$, $P \in \{4, 9\}$; same star cut-offs |
| Train Builder | $+(10 + 5[\text{streak} > 2])$, $-2$ per mistake | $a = \frac{10}{10 + m}$; 3★ at $a \ge 0.9$, 2★ at $a \ge 0.7$ |
| Spotter | $+(100 + 20 \cdot \text{streak})$ | Always 3★ |
| Color Matcher | $+100$ per match (max 600) | Always 3★ |

Here $c$ is correct answers and $m$ is mistakes.

**Property.** $a \in (0, 1]$, $a = 1$ exactly when $m = 0$, and $a$ strictly decreases as $m$ grows. This is a well-defined accuracy measure.

---

## 2.14 Security Arguments

### 2.14.1 Tokens (JWT, HS256)

A token is $\text{header}.\text{payload}.\sigma$ with $\sigma = \text{HMAC-SHA256}(K, \text{header}.\text{payload})$, where $K$ is the server's `JWT_SECRET`.

**Property.** Without $K$, producing a valid $\sigma$ for a *changed* payload (for example, a different `assignmentId`) means forging an HMAC. HMAC-SHA256 is a secure message-authentication code, so the best known attack is guessing, which succeeds with probability about $2^{-256}$ per try. So a browser cannot change its own `role`, `classId` or `assignmentId` without the server noticing.

**How the system relies on this.**
- `student-login` puts the chosen `classId` in the token. `GET /portal/assignments` then shows only that class's work.
- `launch` signs `assignmentId` into a 1-hour token, and only after checking that the assignment belongs to this student, this class and this app (`studentAssignmentWhere`).
- `results` refuses a token without `appId`, or with a different `assignmentId` (`data_integrity.test.js` and `integration.test.js` check both).
- Since November 2026 the code has **no fallback secret**: a missing `JWT_SECRET` fails instead of silently using `'secret'`.

### 2.14.2 Passwords (bcrypt, cost 10)

Staff and parent passwords are stored as bcrypt hashes with cost factor 10, which means $2^{10} = 1024$ rounds of the Eksblowfish key schedule per guess. If the database leaked, every guess would need that much work, plus a different salt for each user, so precomputed tables do not work.

**Known weakness, stated honestly:** bulk-enrolled accounts start with the shared password `password123`. Hashing does not protect a password everyone knows, so it must be changed on first use (future work).

### 2.14.3 What passwordless student login trusts

Choosing a class and then an avatar means **anyone at the device can log in as any child in that class**. This is a deliberate trade-off for children who cannot read. It is only acceptable under these conditions: supervised classroom use, a school network, and the teacher controlling the device. See [08_SECURITY_PRIVACY_AND_LICENSING.md](08_SECURITY_PRIVACY_AND_LICENSING.md).

---

## 2.15 Upload Queue Timing

`ai_server.py` handles **one request at a time**. With $n$ uploads arriving together, where upload $i$ needs preparation time $p$ and $m_i$ motions of time $a$ each, they are served in turn. The $j$-th upload finishes at

$$C_j \approx \sum_{i \le j} (p + m_i a)$$

The last one finishes at $C_n \approx np + a\sum_i m_i$.

**Check against measurement** (chapter 14 §6.5): six characters with $\sum m_i = 3 + 1 + 1 + 1 + 1 + 1 = 8$ motions finished at 50.3 s. Taking $p \approx 5$ s gives $8a \approx 20$ s, so $a \approx 2.5$ s per motion. That matches the 2.3 s per motion measured separately with the 320 px copy (chapter 14 §6.3). The model explains the measurement.

**Why one queue rather than parallel work:** chapter 14 found that six uploads running at once competed for CPU and for memory that was already 97% full, making everyone slower. For a single machine, one queue gives the **same total time without memory thrashing**, and the first child sees a result sooner.
