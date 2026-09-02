"""
EduVision Story Engine
======================
Renders a short story from pre-annotated character folders + BVH motions,
then stitches all scenes into one final animated GIF.

Story (3 scenes):
  Scene 1  → The Farmer (test2)  waves hello to the class
  Scene 2  → The Dancer (test3)  does a big dab to celebrate
  Scene 3  → Both characters     dance together to end the show

How stitching works
-------------------
AnimatedDrawings writes each render to {char_anno_dir}/video.gif.
We:
  1. Call annotations_to_animation.py with (char_dir, motion_cfg, retarget_cfg)
  2. Copy the resulting video.gif to our own output dir before the next render
     overwrites it.
  3. For each scene, we composite all character GIFs side-by-side onto a shared
     canvas frame-by-frame using Pillow, adding a caption bar at the bottom.
  4. All scene GIFs are concatenated end-to-end into one final story GIF.
"""

import os
import sys
import shutil
import subprocess
import logging
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).resolve().parent.parent
AD_ROOT    = REPO_ROOT / "Actual repo (EDUVISION)" / "AnimatedDrawings"
EXAMPLES   = AD_ROOT / "examples"
MOTION_DIR = EXAMPLES / "config" / "motion"
RETARGET_FAIR1 = str(EXAMPLES / "config" / "retarget" / "fair1_ppf.yaml")
RETARGET_CMU1  = str(EXAMPLES / "config" / "retarget" / "cmu1_pfp.yaml")
ANIM_SCRIPT    = str(EXAMPLES / "annotations_to_animation.py")

STORY_OUT  = Path(__file__).resolve().parent / "output"
STORY_OUT.mkdir(parents=True, exist_ok=True)

CONDA_ENV  = "animated_drawings"

# ─────────────────────────────────────────────────────────────────────────────
# STORY DEFINITION
# Each scene = list of characters, each with a char_dir and motion name.
# The motion name must match a .yaml in examples/config/motion/
# ─────────────────────────────────────────────────────────────────────────────
# Motion → retarget mapping (must match BVH skeleton)
# fair1 motions  : dab, wave_hello, zombie, jumping  → fair1_ppf
# cmu1  motions  : jumping_jacks                     → cmu1_pfp

STORY = [
    {
        "title":    "Scene 1",
        "caption":  "The farmer walks out and waves hello to the class!",
        "characters": [
            {"name": "farmer", "char_dir": EXAMPLES / "test2_out",
             "motion": "wave_hello", "retarget": RETARGET_FAIR1},
        ],
    },
    {
        "title":   "Scene 2",
        "caption": "The dancer creeps in like a zombie!",
        "characters": [
            {"name": "dancer", "char_dir": EXAMPLES / "test3_out",
             "motion": "zombie",     "retarget": RETARGET_FAIR1},
        ],
    },
    {
        "title":   "Scene 3",
        "caption": "Together, they do jumping jacks to end the show!",
        "characters": [
            {"name": "farmer", "char_dir": EXAMPLES / "test2_out",
             "motion": "jumping_jacks", "retarget": RETARGET_CMU1},
            {"name": "dancer", "char_dir": EXAMPLES / "test3_out",
             "motion": "jumping_jacks", "retarget": RETARGET_CMU1},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# CANVAS SETTINGS
# ─────────────────────────────────────────────────────────────────────────────
CHAR_H     = 380      # height each character is scaled to in the composite
CAPTION_H  = 55       # height of the caption bar below the characters
BG_COLOR   = (255, 248, 220)   # warm cream
CAPTION_BG = (40, 40, 60)      # dark navy caption bar
CAPTION_FG = (255, 240, 180)   # warm yellow text
SCENE_FRAMES = 80     # how many frames to take from each scene GIF (≈4 s at 20fps)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 – Render individual character GIFs via AnimatedDrawings
# ─────────────────────────────────────────────────────────────────────────────

def render_character(char_dir: Path, motion: str, retarget: str, save_as: Path) -> Path:
    """
    Calls annotations_to_animation.py, which writes to {char_dir}/video.gif.
    We immediately copy that file to save_as so subsequent renders don't
    overwrite it.
    """
    if save_as.exists():
        log.info(f"    ✓ cached  {save_as.name}")
        return save_as

    motion_cfg = str(MOTION_DIR / f"{motion}.yaml")
    if not Path(motion_cfg).exists():
        raise FileNotFoundError(f"Motion config not found: {motion_cfg}")

    log.info(f"    ▶ rendering  {char_dir.name} × {motion} ...")

    cmd = [
        "conda", "run", "--no-capture-output", "-n", CONDA_ENV,
        "python", ANIM_SCRIPT,
        str(char_dir),
        motion_cfg,
        retarget,
    ]

    env = {**os.environ, "DISPLAY": os.environ.get("DISPLAY", ":0")}

    result = subprocess.run(
        cmd,
        cwd=str(AD_ROOT),          # must run from AD root so 'animated_drawings' is importable
        env=env,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        log.error("    ✗ STDOUT:\n" + result.stdout[-1500:])
        log.error("    ✗ STDERR:\n" + result.stderr[-1500:])
        raise RuntimeError(f"Render failed: {char_dir.name}/{motion}")

    raw_gif = char_dir / "video.gif"
    if not raw_gif.exists():
        raise FileNotFoundError(f"Expected output not found: {raw_gif}")

    shutil.copy2(raw_gif, save_as)
    log.info(f"    ✓ saved  {save_as.name}")
    return save_as


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 – Composite multiple character GIFs side-by-side for one scene
# ─────────────────────────────────────────────────────────────────────────────

def load_gif_frames(gif_path: Path) -> list:
    """Return list of RGBA PIL.Image frames from a GIF file."""
    frames = []
    with Image.open(gif_path) as im:
        try:
            while True:
                frames.append(im.convert("RGBA").copy())
                im.seek(im.tell() + 1)
        except EOFError:
            pass
    return frames


def scale_to_height(frame: Image.Image, h: int) -> Image.Image:
    """Scale a frame so its height == h, preserving aspect ratio."""
    w0, h0 = frame.size
    new_w  = max(1, int(w0 * h / h0))
    return frame.resize((new_w, h), Image.LANCZOS)


def get_font(size: int = 20):
    candidates = [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def composite_scene(gif_paths: list, scene: dict, out_path: Path) -> Path:
    """
    Side-by-side compositing:
      - Each character's GIF is scaled to CHAR_H.
      - Characters are placed left→right on a shared canvas.
      - A caption bar is drawn below.
      - Shorter GIFs loop so all animations run for SCENE_FRAMES frames.
      - Saved as a 20 fps GIF.
    """
    if out_path.exists():
        log.info(f"  ✓ cached composite  {out_path.name}")
        return out_path

    log.info(f"  Compositing  «{scene['title']}» ...")

    all_frames = [load_gif_frames(p) for p in gif_paths]
    scaled     = [[scale_to_height(f, CHAR_H) for f in fl] for fl in all_frames]

    char_widths = [s[0].width for s in scaled]
    canvas_w    = sum(char_widths)
    canvas_h    = CHAR_H + CAPTION_H

    font = get_font(20)
    out_frames = []

    for i in range(SCENE_FRAMES):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), BG_COLOR + (255,))
        draw   = ImageDraw.Draw(canvas)

        # Paste each character (looping if needed)
        x = 0
        for char_frames in scaled:
            frame = char_frames[i % len(char_frames)]
            # Flatten RGBA onto cream background
            bg = Image.new("RGBA", frame.size, BG_COLOR + (255,))
            blended = Image.alpha_composite(bg, frame)
            canvas.paste(blended.convert("RGB"), (x, 0))
            x += frame.width

        # Caption bar
        draw.rectangle([(0, CHAR_H), (canvas_w, canvas_h)], fill=CAPTION_BG + (255,))

        caption = scene["caption"]
        bbox    = draw.textbbox((0, 0), caption, font=font)
        tw, th  = bbox[2] - bbox[0], bbox[3] - bbox[1]
        tx = max(4, (canvas_w - tw) // 2)
        ty = CHAR_H + (CAPTION_H - th) // 2
        draw.text((tx, ty), caption, font=font, fill=CAPTION_FG)

        # Quantise to palette for GIF
        out_frames.append(canvas.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT))

    out_frames[0].save(
        out_path,
        save_all=True,
        append_images=out_frames[1:],
        loop=0,
        duration=50,      # 50 ms = 20 fps
        optimize=True,
    )
    log.info(f"  ✓ composited  {out_path.name}  ({SCENE_FRAMES} frames)")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 – Concatenate all scene GIFs into one final story GIF
# ─────────────────────────────────────────────────────────────────────────────

def add_scene_title_card(title: str, width: int, height: int, n_frames: int = 20) -> list:
    """Generate a short title-card clip (dark background + centred title text)."""
    font   = get_font(28)
    frames = []
    for _ in range(n_frames):
        card = Image.new("RGB", (width, height), (30, 30, 50))
        draw = ImageDraw.Draw(card)
        bbox = draw.textbbox((0, 0), title, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((width - tw) // 2, (height - th) // 2), title,
                  font=font, fill=(255, 230, 100))
        frames.append(card.quantize(colors=256, method=Image.MEDIANCUT))
    return frames


def concatenate_scenes(scene_gifs: list, scene_titles: list, out_path: Path) -> Path:
    """
    Join scene GIFs end-to-end:
      - Find max canvas size across all scenes.
      - Pad each frame to that size (centred on BG_COLOR).
      - Insert a short title card before each scene.
      - Save as one continuous GIF.
    """
    if out_path.exists():
        log.info(f"✓ cached final  {out_path.name}")
        return out_path

    log.info("Concatenating scenes → final story GIF ...")

    all_scene_frames = [load_gif_frames(p) for p in scene_gifs]

    max_w = max(f[0].width  for f in all_scene_frames)
    max_h = max(f[0].height for f in all_scene_frames)

    final_frames = []

    for title, scene_frames in zip(scene_titles, all_scene_frames):
        # Title card
        final_frames.extend(add_scene_title_card(title, max_w, max_h, n_frames=25))

        # Scene frames (padded to max canvas)
        for frame in scene_frames:
            canvas = Image.new("RGB", (max_w, max_h), BG_COLOR)
            x_off  = (max_w - frame.width)  // 2
            y_off  = (max_h - frame.height) // 2
            canvas.paste(frame.convert("RGB"), (x_off, y_off))
            final_frames.append(canvas.quantize(colors=256, method=Image.MEDIANCUT))

    final_frames[0].save(
        out_path,
        save_all=True,
        append_images=final_frames[1:],
        loop=0,
        duration=50,
        optimize=True,
    )
    total_secs = len(final_frames) * 0.05
    log.info(f"✓ Final story GIF → {out_path}")
    log.info(f"  {len(final_frames)} frames  ≈ {total_secs:.1f} s at 20 fps")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("EduVision Story Engine")
    log.info("=" * 60)

    scene_gifs   = []
    scene_titles = []

    for s_idx, scene in enumerate(STORY):
        log.info(f"\n{'─'*50}")
        log.info(f"▶  {scene['title']}")

        # Step 1: render each character in the scene
        gif_paths = []
        for char in scene["characters"]:
            save_as = STORY_OUT / f"s{s_idx}_{char['name']}_{char['motion']}.gif"
            gif     = render_character(
                char["char_dir"], char["motion"], char["retarget"], save_as
            )
            gif_paths.append(gif)

        # Step 2: composite all characters for this scene side-by-side
        scene_gif = STORY_OUT / f"scene{s_idx}_composite.gif"
        composite_scene(gif_paths, scene, scene_gif)
        scene_gifs.append(scene_gif)
        scene_titles.append(scene["title"])

    # Step 3: concatenate all scenes
    log.info(f"\n{'─'*50}")
    final_gif = STORY_OUT / "story_final.gif"
    concatenate_scenes(scene_gifs, scene_titles, final_gif)

    log.info("\n" + "=" * 60)
    log.info(f"🎉  Done!  Open:  story_engine/output/story_final.gif")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
