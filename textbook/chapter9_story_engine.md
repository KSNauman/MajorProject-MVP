# Chapter 9: Multi-Scene Story Engine & Adding Custom BVH Animations

## Today's Achievement: The Automated Storytelling Pipeline
We successfully bridged the gap between individual character rendering and full-blown storytelling! The new `story_engine/tell_story_video.py` orchestrates the complete animation pipeline:

1. **Rendering Characters:** Automatically loops through the story definition and uses Meta's `annotations_to_animation.py` to render each character individually with their assigned `.bvh` motion.
2. **Video Compositing (MoviePy):** Instead of using PIL to stitch GIFs, we upgraded to `MoviePy` to build MP4 videos. We dynamically place characters side-by-side onto a unified background for each scene.
3. **Text-To-Speech (TTS):** We integrated Google TTS (`gTTS`) to automatically read the scene captions out loud.
4. **Intelligent Looping:** The engine compares the duration of the scene's voiceover to the duration of the animation loop. If the audio is longer, it seamlessly loops the character animation so they don't freeze on screen.
5. **Final Stitching:** All scenes are concatenated end-to-end, complete with title cards, producing a final `story_final_with_audio.mp4` file.

This transitions EduVision from a simple "animator" to a fully automated **"AI Movie Director"**.

---

## How to Get & Add Custom Animations (BVH Files)

> **Important Note on Mixamo:** Adobe Mixamo officially retired direct `.bvh` exports. Mixamo now only exports `.fbx` and `.dae` formats. 

To use new motions in the Meta AnimatedDrawings engine, you have two primary options:

### Method A: Use Pre-Converted Mixamo BVH Repositories (Recommended & Fastest)
Because Mixamo only exports `.fbx`, the community has converted and mirrored the entire Mixamo motion library into ready-to-use `.bvh` files on GitHub:
1. Search GitHub for **`mixamo bvh`** repositories (or open motion databases like the **CMU Graphics Lab Motion Capture Database**).
2. Download any ready `.bvh` file (e.g. `walking.bvh`).
3. Save it inside the repo at:
   `Actual repo (EDUVISION)/AnimatedDrawings/examples/bvh/mixamo/walking.bvh`

### Method B: Convert Mixamo FBX to BVH via Blender
If you download an `.fbx` file directly from Mixamo:
1. On Mixamo, choose **`FBX Binary (.fbx)`** and set Skin to **`Without Skin`**.
2. Import the `.fbx` file into Blender (`File -> Import -> FBX`).
3. Export it as BVH (`File -> Export -> Motion Capture (.bvh)`).
4. Save the `.bvh` file in `examples/bvh/mixamo/`.

---

### Step 2: Create a Motion Config YAML
The engine needs to know how to orient and scale the raw BVH data. 
Create a new file in `Actual repo (EDUVISION)/AnimatedDrawings/examples/config/motion/salsa_dance.yaml`.

For **Mixamo** animations, the configuration should look like this:
```yaml
filepath: examples/bvh/mixamo/salsa_dance.bvh
start_frame_idx: 0
end_frame_idx: null
groundplane_joint: LeftFoot
forward_perp_joint_vectors:
  - - LeftShoulder
    - RightShoulder
  - - LeftUpLeg
    - RightUpLeg
scale: 0.01  # Mixamo skeletons are scaled down by 100x
up: +y       # Mixamo up-axis is Y
```

### Step 3: Match the Retarget Configuration
Different motion capture systems name their bones differently (e.g., `RightArm` vs `RightForeArm`). The engine uses a "Retarget Configuration" to map the BVH bone names to our 2D drawing skeleton.

Whenever you use a **Mixamo** or **Rokoko** BVH file, you MUST use the Mixamo retarget config.

In the `STORY` dictionary inside `tell_story_video.py`, you will assign the retarget configuration like this:
```python
RETARGET_MIXAMO = str(EXAMPLES / "config" / "retarget" / "mixamo_fff.yaml")

# Inside the STORY array:
{
    "name": "farmer",
    "char_dir": EXAMPLES / "test2_out",
    "motion": "salsa_dance",            # Points to your new motion config
    "retarget": RETARGET_MIXAMO         # Maps the Mixamo bones correctly!
}
```

### Summary of Retarget Mapping Rules:
* **Mixamo/Rokoko BVH:** Use `mixamo_fff.yaml`
* **CMU BVH:** Use `cmu1_pfp.yaml` (e.g., the built-in `jumping_jacks`)
* **FAIR BVH:** Use `fair1_ppf.yaml` (e.g., the built-in `wave_hello`, `dab`, `zombie`)

Once you've done this, run `python tell_story_video.py` and your character will start performing the new animation immediately!

---

## MVP Story Blueprint: The Honest Woodcutter

To prepare for our web app integration, we are standardizing around a single, highly engaging story: **The Honest Woodcutter**. This story relies purely on bipedal humanoid characters, avoiding the complexities of quadruped animal skeletons.

### 1. Dynamic Input Sketches (Child / Teacher Uploads)
Only two character drawings need to be uploaded by the user:
* `woodcutter_sketch.png`: Woodcutter character (holding an axe or simple stick).
* `fairy_sketch.png`: Fairy character (magical spirit with 2 arms & 2 legs).

### 2. Pre-set Scene Backgrounds (App Static Assets)
Instead of a plain background, the web application maintains pre-generated/designed static background images:
* `bg_forest_river.png`: A serene forest scene with a river bank. (Used for Scenes 1, 2, and 3).
* `bg_magical_forest.png`: A bright, magical glowing forest bank. (Used for Scene 4 celebration).

### 3. Layer Compositing Architecture
Each scene frame is constructed by stacking three distinct layers in order:

```
┌────────────────────────────────────────────────────────┐
│ Layer 3: Caption Bar + Subtitles + TTS Voiceover Audio  │  (Top Layer)
├────────────────────────────────────────────────────────┤
│ Layer 2: Animated Transparent Character GIFs            │  (Middle Layer)
│          - Woodcutter positioned at (X1, Y_ground)     │
│          - Fairy positioned at (X2, Y_ground)          │
├────────────────────────────────────────────────────────┤
│ Layer 1: Pre-set Static Background (Forest/River Image)│  (Bottom Base Layer)
└────────────────────────────────────────────────────────┘
```

### 4. Required BVH Motions
For the webapp production, these specific animations will be mapped to the sketches:

| Scene | Character | Required Motion | Prototype Substitute | Position on Screen |
| :--- | :--- | :--- | :--- | :--- |
| **Scene 1** | Woodcutter | `sad_walk.bvh` | `zombie` | Walking Left → Center |
| **Scene 2** | Woodcutter | `crying_idle.bvh` | `jumping` | Standing Left |
| **Scene 2** | Fairy | `magical_appear.bvh` | `wave_hello` | Floating Right |
| **Scene 3** | Woodcutter | `shake_head_no.bvh` | `dab` | Standing Left |
| **Scene 3** | Fairy | `holding_axes.bvh` | `wave_hello` | Standing Right |
| **Scene 4** | Both | `joyful_dance.bvh` | `jumping_jacks` | Side-by-side Center |

### 5. Story Script (Captions & TTS Voiceovers)
These captions will be automatically read aloud by the Google TTS engine during the video:
* **Scene 1:** "Once upon a time, an honest woodcutter trudged sadly through the forest."
* **Scene 2:** "He had lost his axe in the river! Suddenly, a magical fairy appeared to help."
* **Scene 3:** "She offered him a golden axe, but the woodcutter honestly refused it."
* **Scene 4:** "Because he told the truth, the fairy rewarded him, and they celebrated together!"
