# Chapter 9 (Supplement): How Story Generation Works — A Deep Dive

This document explains the complete end-to-end pipeline of `story_engine/tell_story_video.py` in detail. It is intended for anyone who wants to understand the engineering behind the EduVision story engine, or wants to extend it further.

---

## The Big Picture

The story engine is essentially a **mini film production pipeline** running entirely on your local machine. At the highest level it does five things:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  1. RENDER   │───▶│ 2. COMPOSITE │───▶│  3. AUDIO    │───▶│  4. ENCODE   │───▶│  5. OUTPUT   │
│  Characters  │    │    Scenes    │    │  (TTS voice) │    │  (MP4 video) │    │  Final Film  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

Each step is implemented as a Python function in `tell_story_video.py`. Let's go through each one in detail.

---

## Step 0: The Story Definition (Your Script)

Everything starts with the `STORY` array at the top of the script. This is your **director's script** — it defines every scene, who is in it, what they do, and what the narrator says.

```python
STORY = [
    {
        "title":   "Scene 1",
        "caption": "Once upon a time, an honest woodcutter trudged sadly through the forest.",
        "characters": [
            {
                "name":    "woodcutter",
                "char_dir": EXAMPLES / "test2_out",   # folder containing the annotated sketch
                "motion":  "walk",                    # name of the .yaml in config/motion/
                "retarget": RETARGET_MIXAMO_SIMPLE,   # which skeleton mapping to use
                "pan":     True,                      # should this char drift left → right?
            }
        ],
    },
    # ... more scenes
]
```

Each scene is a Python dictionary with:
- **`title`** — shown as a title card before the scene plays.
- **`caption`** — the narration text, spoken aloud by Google TTS.
- **`characters`** — a list of characters appearing in this scene. Each character has:
  - **`char_dir`** — the folder produced by the annotation pipeline (`test2_out/`). It contains the character sketch, mask, and skeleton JSON files.
  - **`motion`** — the name of a YAML file in `examples/config/motion/`. This points to a BVH animation file.
  - **`retarget`** — the bone-mapping config. This is critical: different BVH files use different joint names, so you must choose the correct retarget config (see Step 1 below).
  - **`pan`** *(optional)* — if `True`, the character smoothly slides from the left edge to the right edge of the screen during the scene, creating a walking-through-scene effect.

---

## Step 1: Rendering Each Character (BVH → GIF)

**Function:** `render_character(char_dir, motion, retarget, save_as)`

This is the core of the pipeline. For each character in each scene, we call Meta's `annotations_to_animation.py` script as a subprocess.

### What happens inside `annotations_to_animation.py`:
1. **Loads the character:** Reads the sketch image, mask PNG, and `char_cfg.yaml` (which contains the skeleton joint positions placed during annotation).
2. **Loads the BVH motion:** Reads the `.bvh` file specified in the motion YAML. A BVH file is a plain text file containing:
   - A **HIERARCHY** block: the skeleton joint tree (joint names and their parent-child relationships).
   - A **MOTION** block: a table of rotation values for every joint at every frame.
3. **Retargeting:** The BVH skeleton has joint names like `LeftArm`, `RightUpLeg`. Our 2D character skeleton has joint names like `left_elbow`, `right_knee`. The **retarget config YAML** maps one to the other:
   ```yaml
   char_joint_bvh_joints_mapping:
     left_elbow: [LeftArm, LeftForeArm]   # map from 2D joint → two BVH joints
     right_knee: [RightUpLeg, RightLeg]
   ```
   The engine reads both angles and computes the angle for the 2D joint by projecting the 3D BVH pose onto a 2D frontal plane. This is the key mathematical step that brings BVH data to life on a flat drawing.
4. **Mesh Deformation (ARAP):** The character sketch is not a rigid rectangle — it is a deformable mesh. The engine uses **As-Rigid-As-Possible (ARAP)** deformation to smoothly warp the drawing pixels as the skeleton moves. This preserves the original artwork style.
5. **Renders to GIF:** The engine runs an OpenGL loop, writes each frame to a buffer, and saves the full animation as `{char_dir}/video.gif`.

### Why we copy the GIF immediately:
`annotations_to_animation.py` always writes to `{char_dir}/video.gif`. If we render two characters using the same `char_dir`, the second render will overwrite the first. So immediately after each render, we copy `video.gif` to a unique name in our `story_engine/output/` folder:
```
s0_woodcutter_walk.gif    ← Scene 0, Woodcutter, walk motion
s1_fairy_wave.gif         ← Scene 1, Fairy, wave motion
```

### Caching:
If the output GIF already exists, we skip re-rendering. This means re-runs are extremely fast when only changing captions or compositing settings.

---

## Step 2: Compositing the Scene (GIF → Scene GIF)

**Function:** `composite_scene(gif_paths, scene, out_path)`

Now we take the individual transparent character GIFs and compose them together onto a single canvas for each scene.

### The Canvas:
- **Fixed width:** `CANVAS_W = 760px` (always the same width, so scenes don't jump in size).
- **Height:** `CHAR_H (380px) + CAPTION_H (55px)`.
- **Background color:** Warm cream `(255, 248, 220)`.

### Frame-by-Frame Compositing:
We build `SCENE_FRAMES = 80` frames (4 seconds at 20fps). For each frame `i`:

```
FOR each frame i in 0..79:
    1. Create blank cream canvas (760 × 435 px)
    2. FOR each character in this scene:
         a. Get frame[i % len(character_frames)]  ← LOOP if animation is shorter than 80 frames
         b. IF pan=True:
              t = i / 79           (goes from 0.0 → 1.0)
              x = t × (760 - char_width)   (slides L → R, stays on-screen)
              y = CHAR_H - char_height     (pinned to ground level)
         c. ELSE:
              x = slot centre position
              y = 0
         d. Alpha-composite the RGBA character frame onto the canvas
    3. Draw the dark navy caption bar at the bottom
    4. Draw the caption text centred in the caption bar
    5. Quantise to 256-colour palette and append to frame list
SAVE as scene_N_composite.gif
```

### The Pan Effect:
When `pan=True`, the character is:
- Scaled to `PAN_CHAR_H = 200px` (smaller than normal, to look like they're further away in the background).
- Given a `y` position that keeps their feet on the "ground line" (bottom of the character area).
- Moved from `x=0` (left edge of screen) to `x = canvas_w - char_w` (right edge) over the 80 frames.

### Automatic Looping:
The walk animation might only be 60 frames long, but we need 80 frames. We use the modulo operator `i % len(frames)` to seamlessly loop the animation. The character never freezes.

---

## Step 3: Generating the Voiceover (Caption → MP3)

**Function:** `generate_audio(text, out_path)`

We use **Google Text-to-Speech (`gTTS`)** to convert the scene caption into a spoken audio file.

```python
from gtts import gTTS
tts = gTTS(text=caption, lang="en", slow=False)
tts.save("scene_0_audio.mp3")
```

This sends the text to Google's TTS API over the internet and saves the result as an MP3 file. The resulting audio is a natural-sounding English narration.

**One audio file is generated per scene**, saved as `scene_0_audio.mp3`, `scene_1_audio.mp3`, etc.

---

## Step 4: Encoding Each Scene to MP4 (GIF + MP3 → MP4)

**Function:** `scene_gif_to_video(gif_path, audio_path, out_path)`

We use **MoviePy** to combine the scene GIF frames with the voiceover audio into a proper MP4 video clip.

```python
from moviepy.editor import VideoFileClip, AudioFileClip
from moviepy.video.fx.all import loop

video = VideoFileClip(str(gif_path))
audio = AudioFileClip(str(audio_path))

# If voice is longer than animation, loop the animation to match
if audio.duration > video.duration:
    video = loop(video, duration=audio.duration)
else:
    audio = audio.subclip(0, video.duration)

video = video.set_audio(audio)
video.write_videofile(str(out_path), fps=20, codec="libx264", audio_codec="aac")
```

The key design decision here is **audio-driven duration**: the scene lasts exactly as long as it takes to speak the caption aloud. If the animation loop is shorter than the narration, the characters keep dancing until the narrator finishes — they never freeze.

---

## Step 5: Adding Title Cards

**Function:** `add_scene_title_card(title, width, height)`

Before each scene, we insert a short **title card** — a dark navy frame with the scene title in white text (e.g., "Scene 1"). This gives the video a professional, chapter-like feel. It is generated entirely in Python using Pillow's `ImageDraw` module (no external assets needed).

---

## Step 6: Concatenating All Scenes into the Final MP4

**Function (inside `main()`):**

```python
from moviepy.editor import concatenate_videoclips

final = concatenate_videoclips([title_card_1, scene_1, title_card_2, scene_2, ...])
final.write_videofile("story_final_with_audio.mp4", fps=20, codec="libx264")
```

All title cards and scene clips are concatenated in order into the final MP4. The output file is a fully self-contained video file with:
- **Video:** H.264 encoded, 20fps, 760×435 resolution.
- **Audio:** AAC encoded, synchronized narration for each scene.

---

## Full Pipeline Diagram

```
STORY array
    │
    ▼
For each Scene:
    │
    ├─── For each Character:
    │         │
    │         ├── [char_dir] + [motion.yaml] + [retarget.yaml]
    │         │         │
    │         │         ▼
    │         │   annotations_to_animation.py
    │         │   (BVH → ARAP deformation → OpenGL render → video.gif)
    │         │         │
    │         │         ▼
    │         │   Copy → s{N}_{name}_{motion}.gif  (cached)
    │         │
    │         └── (repeat for next character)
    │
    ├─── composite_scene()
    │         │
    │         │   Frame-by-frame Pillow compositing:
    │         │   [background] + [char1 frames] + [char2 frames] + [caption bar]
    │         │   Pan: x = t × (canvas_w - char_w)
    │         │         │
    │         │         ▼
    │         │   scene{N}_composite.gif  (cached)
    │
    ├─── generate_audio()
    │         │
    │         │   gTTS → scene_{N}_audio.mp3
    │
    └─── scene_gif_to_video()
              │
              │   MoviePy: GIF + MP3 → scene_{N}.mp4
              │   (loops animation if audio > video duration)
              │
              ▼
         [scene_0.mp4] [scene_1.mp4] [scene_2.mp4] [scene_3.mp4]
              │
              ▼
        concatenate_videoclips()
              │
              ▼
    story_final_with_audio.mp4  ✅
```

---

## Key Engineering Decisions Explained

| Decision | Why |
| :--- | :--- |
| **BVH format for motion** | BVH is a plain-text, open standard. It's human-readable and universally supported by all 3D animation tools. |
| **Per-character retarget configs** | Different BVH sources (FAIR, CMU, Mixamo) use different bone names. Mapping is done per-character so you can mix skeletons in the same scene. |
| **GIF as intermediate format** | `annotations_to_animation.py` only outputs GIFs. We keep GIFs as intermediate files and convert to MP4 at the final stage. |
| **Fixed `CANVAS_W`** | Having a consistent canvas width means every scene is the same size. Without this, scenes with 1 character would be narrower than scenes with 2, causing jarring jumps when the scenes are concatenated. |
| **Audio-driven scene duration** | The story feels natural because the animation waits for the narrator to finish, rather than cutting off mid-sentence. |
| **Caching at every step** | Rendering a single character animation takes ~30 seconds. The cache means you only re-render what actually changed when you edit the story. |
