"""
EduVision Story Engine — "A Day at the Park" (Polished)
=======================================================
A 6-scene children's story built entirely on the existing BVH/retarget pipeline.

Characters
----------
  Child   → test2_out
  Friend  → test3_out
  Teacher → test4_out

Available motions
-----------------
  walk         (mixamo_simple)
  wave         (mixamo_simple)
  dab          (fair1_ppf)
  jumping      (fair1_ppf)
  wave_hello   (fair1_ppf)
  zombie       (fair1_ppf)
  jumping_jacks (cmu1_pfp)
"""

import os
import sys
import shutil
import subprocess
import logging
import numpy as np
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

RETARGET_FAIR1         = str(EXAMPLES / "config" / "retarget" / "fair1_ppf.yaml")
RETARGET_CMU1          = str(EXAMPLES / "config" / "retarget" / "cmu1_pfp.yaml")
RETARGET_MIXAMO_SIMPLE = str(EXAMPLES / "config" / "retarget" / "mixamo_simple.yaml")

ANIM_SCRIPT = str(EXAMPLES / "annotations_to_animation.py")
STORY_OUT   = Path(__file__).resolve().parent / "output"
STORY_OUT.mkdir(parents=True, exist_ok=True)

CONDA_ENV = "animated_drawings"

# ─────────────────────────────────────────────────────────────────────────────
# CHARACTER DIRECTORIES
# ─────────────────────────────────────────────────────────────────────────────
CHILD   = EXAMPLES / "test2_out"
FRIEND  = EXAMPLES / "test3_out"
TEACHER = EXAMPLES / "test4_out"

# ─────────────────────────────────────────────────────────────────────────────
# STORY — "A Day at the Park"
# FIX 5: Captions shortened for 3–8 year-old readability
# ─────────────────────────────────────────────────────────────────────────────
STORY = [
    {
        "title":   "Arriving at the Park",
        "caption": "One bright morning, a child went to the park. A good friend arrived too!",
        "characters": [
            {"name": "child",  "char_dir": CHILD,  "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "left"},
            {"name": "friend", "char_dir": FRIEND, "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "right"},
        ],
    },
    {
        "title":   "Saying Hello",
        "caption": "The friends smiled and said hello!",
        "characters": [
            {"name": "child",  "char_dir": CHILD,  "motion": "wave",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": False, "x_frac": 0.28},
            {"name": "friend", "char_dir": FRIEND, "motion": "wave_hello",
             "retarget": RETARGET_FAIR1,         "pan": False, "x_frac": 0.68},
        ],
    },
    {
        "title":   "Playing Together",
        "caption": "They played and laughed together. So much fun!",
        "characters": [
            {"name": "child",  "char_dir": CHILD,  "motion": "jumping",
             "retarget": RETARGET_FAIR1, "pan": False, "x_frac": 0.30},
            {"name": "friend", "char_dir": FRIEND, "motion": "jumping_jacks",
             "retarget": RETARGET_CMU1,  "pan": False, "x_frac": 0.70},
        ],
    },
    {
        "title":   "The Teacher Arrives",
        "caption": "Their teacher came and asked, are you having fun?",
        "characters": [
            {"name": "teacher", "char_dir": TEACHER, "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "left",
             "pan_end_frac": 0.22},
            {"name": "child",   "char_dir": CHILD,   "motion": "dab",
             "retarget": RETARGET_FAIR1,         "pan": False, "x_frac": 0.50},
            {"name": "friend",  "char_dir": FRIEND,  "motion": "dab",
             "retarget": RETARGET_FAIR1,         "pan": False, "x_frac": 0.75},
        ],
    },
    {
        "title":   "A Happy Choice",
        "caption": "What should we do next? Let us play one more game!",
        "characters": [
            {"name": "teacher", "char_dir": TEACHER, "motion": "wave_hello",
             "retarget": RETARGET_FAIR1, "pan": False, "x_frac": 0.18},
            {"name": "child",   "char_dir": CHILD,   "motion": "jumping",
             "retarget": RETARGET_FAIR1, "pan": False, "x_frac": 0.50},
            {"name": "friend",  "char_dir": FRIEND,  "motion": "jumping_jacks",
             "retarget": RETARGET_CMU1,  "pan": False, "x_frac": 0.78},
        ],
    },
    {
        "title":   "Going Home",
        "caption": "When the sun set, they all walked home. What a wonderful day!",
        "characters": [
            {"name": "teacher", "char_dir": TEACHER, "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "left",
             "pan_start_frac": 0.05},
            {"name": "child",   "char_dir": CHILD,   "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "left",
             "pan_start_frac": 0.35},
            {"name": "friend",  "char_dir": FRIEND,  "motion": "walk",
             "retarget": RETARGET_MIXAMO_SIMPLE, "pan": True, "pan_dir": "left",
             "pan_start_frac": 0.60},
        ],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# CANVAS SETTINGS
# FIX 2: Standardized to 760 × 435 (CHAR_H 370 + CAPTION_H 65)
# FIX 3: Ground line = CHAR_H (all characters pinned here consistently)
# ─────────────────────────────────────────────────────────────────────────────
CHAR_H       = 370      # standard character height
PAN_CHAR_H   = 220      # smaller height for panning characters
CANVAS_W     = 760
CAPTION_H    = 65
CANVAS_H     = CHAR_H + CAPTION_H   # 435
BG_COLOR     = (220, 240, 220)       # soft park-green
CAPTION_BG   = (30,  60,  30)        # dark forest green
CAPTION_FG   = (240, 255, 200)       # light lime text
SCENE_FRAMES = 80                    # 80 frames at 20fps = 4s base loop

# FIX 1 & FIX 4: Shorter title cards to reduce silent tail
TITLE_CARD_FRAMES = 16   # 0.8s per title card
END_CARD_FRAMES   = 40   # 2.0s for end card

# FIX 4: Crossfade duration in seconds between scenes
CROSSFADE_S = 0.3


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 – Render individual character GIFs
# ─────────────────────────────────────────────────────────────────────────────

def render_character(char_dir: Path, motion: str, retarget: str, save_as: Path) -> Path:
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
        str(char_dir), motion_cfg, retarget,
    ]
    env = {**os.environ, "DISPLAY": os.environ.get("DISPLAY", ":0")}
    result = subprocess.run(cmd, cwd=str(AD_ROOT), env=env,
                            capture_output=True, text=True)

    if result.returncode != 0:
        log.error("    ✗ STDERR:\n" + result.stderr[-2000:])
        raise RuntimeError(f"Render failed: {char_dir.name}/{motion}")

    raw_gif = char_dir / "video.gif"
    if not raw_gif.exists():
        raise FileNotFoundError(f"Expected output not found: {raw_gif}")

    shutil.copy2(raw_gif, save_as)
    log.info(f"    ✓ saved  {save_as.name}")
    return save_as


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 – Composite scene GIFs
# ─────────────────────────────────────────────────────────────────────────────

def load_gif_frames(gif_path: Path) -> list:
    frames = []
    with Image.open(gif_path) as im:
        try:
            while True:
                frames.append(im.convert("RGBA").copy())
                im.seek(im.tell() + 1)
        except EOFError:
            pass
    return frames


def scale_to_height(img: Image.Image, target_h: int) -> Image.Image:
    ratio = target_h / img.height
    return img.resize((max(1, int(img.width * ratio)), target_h), Image.LANCZOS)


def get_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
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
    """Composite multiple character GIFs side-by-side with caption bar.

    FIX 3: All characters (panning or static) are pinned so their bottom edge
    sits on the ground line at y=CHAR_H. This prevents floating.
    FIX 5: Single-line centered caption with consistent font size.
    """
    if out_path.exists():
        log.info(f"  ✓ cached composite  {out_path.name}")
        return out_path

    log.info(f"  Compositing  «{scene['title']}» ...")
    chars = scene["characters"]

    all_frames = [load_gif_frames(p) for p in gif_paths]
    scaled = []
    for cfg, frames in zip(chars, all_frames):
        h = PAN_CHAR_H if cfg.get("pan", False) else CHAR_H
        scaled.append([scale_to_height(f, h) for f in frames])

    canvas_w = CANVAS_W
    canvas_h = CANVAS_H
    caption_font = get_font(17)
    out_frames = []

    for i in range(SCENE_FRAMES):
        canvas = Image.new("RGBA", (canvas_w, canvas_h), BG_COLOR + (255,))
        draw   = ImageDraw.Draw(canvas)
        t = i / max(SCENE_FRAMES - 1, 1)

        for idx, (cfg, char_frames) in enumerate(zip(chars, scaled)):
            frame  = char_frames[i % len(char_frames)]
            char_w = frame.width
            char_h = frame.height
            pan    = cfg.get("pan", False)

            if pan:
                direction  = cfg.get("pan_dir", "left")
                start_frac = cfg.get("pan_start_frac", 0.0)
                end_frac   = cfg.get("pan_end_frac",   1.0)
                start_x    = int(start_frac * canvas_w)
                end_x      = int(end_frac   * canvas_w)

                if direction == "left":
                    travel = end_x - start_x - char_w
                    x_pos  = start_x + int(t * max(travel, 0))
                else:
                    travel = end_x - start_x - char_w
                    x_pos  = (end_x - char_w) - int(t * max(travel, 0))
            else:
                x_frac = cfg.get("x_frac", (idx + 1) / (len(chars) + 1))
                x_pos  = int(x_frac * canvas_w) - char_w // 2

            # FIX 3: Pin feet to ground line consistently
            y_pos = CHAR_H - char_h

            # Clamp X to canvas bounds
            x_pos = max(0, min(x_pos, canvas_w - char_w))

            # Fix: paste directly using the alpha channel as a mask
            # This prevents character bounding boxes from overwriting each other
            canvas.paste(frame, (x_pos, y_pos), frame)

        # FIX 5: Clean caption bar — single centred line
        draw.rectangle([(0, CHAR_H), (canvas_w, canvas_h)], fill=CAPTION_BG + (255,))
        caption = scene["caption"]
        bbox = draw.textbbox((0, 0), caption, font=caption_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = max(4, (canvas_w - tw) // 2)
        ty = CHAR_H + (CAPTION_H - th) // 2
        draw.text((tx, ty), caption, font=caption_font, fill=CAPTION_FG)

        out_frames.append(canvas.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT))

    out_frames[0].save(
        out_path, save_all=True, append_images=out_frames[1:],
        loop=0, duration=50, optimize=True,
    )
    log.info(f"  ✓ composited  {out_path.name}  ({SCENE_FRAMES} frames)")
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 – Title cards (FIX 2: uses CANVAS_H for consistent dimensions)
# ─────────────────────────────────────────────────────────────────────────────

def make_title_card(title: str, n_frames: int = TITLE_CARD_FRAMES) -> list:
    """Generate short title card frames as numpy arrays (consistent CANVAS_W × CANVAS_H)."""
    font = get_font(26)
    frames = []
    for _ in range(n_frames):
        card = Image.new("RGB", (CANVAS_W, CANVAS_H), (20, 50, 20))
        draw = ImageDraw.Draw(card)
        # Handle multi-line titles (for end card)
        lines = title.split("\n")
        total_h = sum(draw.textbbox((0, 0), l, font=font)[3] - draw.textbbox((0, 0), l, font=font)[1] for l in lines)
        total_h += (len(lines) - 1) * 8  # spacing
        y_start = (CANVAS_H - total_h) // 2
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.text(((CANVAS_W - tw) // 2, y_start), line,
                      font=font, fill=(220, 255, 180))
            y_start += th + 8
        frames.append(np.array(card))
    return frames


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 – TTS Audio
# ─────────────────────────────────────────────────────────────────────────────

def generate_audio(text: str, out_path: Path) -> Path:
    if out_path.exists():
        log.info(f"  ✓ cached audio  {out_path.name}")
        return out_path
    from gtts import gTTS
    log.info(f"  🔊 generating audio  {out_path.name} ...")
    gTTS(text=text, lang="en", slow=False).save(str(out_path))
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 – GIF + Audio → per-scene MP4
# FIX 1: Set final clip duration to exactly audio.duration to avoid silent tail
# ─────────────────────────────────────────────────────────────────────────────

def scene_to_mp4(gif_path: Path, audio_path: Path, out_path: Path) -> Path:
    if out_path.exists():
        log.info(f"  ✓ cached scene MP4  {out_path.name}")
        return out_path

    from moviepy.editor import VideoFileClip, AudioFileClip
    from moviepy.video.fx.all import loop as vfx_loop

    log.info(f"  🎬 encoding scene MP4  {out_path.name} ...")
    video = VideoFileClip(str(gif_path))
    audio = AudioFileClip(str(audio_path))

    # FIX 1: Always set final duration to match audio exactly
    target_dur = audio.duration
    if target_dur > video.duration:
        video = vfx_loop(video, duration=target_dur)
    video = video.subclip(0, target_dur)
    video = video.set_audio(audio)

    video.write_videofile(str(out_path), fps=20, codec="libx264",
                          audio_codec="aac", logger=None)
    video.close()
    audio.close()
    return out_path


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("EduVision Story Engine — A Day at the Park (Polished)")
    log.info("=" * 60)

    from moviepy.editor import VideoFileClip, ImageSequenceClip, concatenate_videoclips

    all_clips = []

    for si, scene in enumerate(STORY):
        log.info("\n" + "─" * 50)
        log.info(f"▶  {scene['title']}")

        # ── Render characters ────────────────────────────────────────────────
        gif_paths = []
        for char in scene["characters"]:
            save_as = STORY_OUT / f"park_s{si}_{char['name']}_{char['motion']}.gif"
            gif = render_character(
                char_dir=Path(char["char_dir"]),
                motion=char["motion"],
                retarget=char["retarget"],
                save_as=save_as,
            )
            gif_paths.append(gif)

        # ── Composite scene GIF ──────────────────────────────────────────────
        comp_gif  = STORY_OUT / f"park_scene{si}_composite.gif"
        composite_scene(gif_paths, scene, comp_gif)

        # ── Generate TTS audio ───────────────────────────────────────────────
        audio_mp3 = STORY_OUT / f"park_scene_{si}_audio.mp3"
        generate_audio(scene["caption"], audio_mp3)

        # ── Encode scene to MP4 ──────────────────────────────────────────────
        scene_mp4 = STORY_OUT / f"park_scene{si}.mp4"
        scene_to_mp4(comp_gif, audio_mp3, scene_mp4)

        # ── FIX 4: Short title card before each scene ────────────────────────
        card_clip = ImageSequenceClip(make_title_card(scene["title"]), fps=20)
        all_clips.append(card_clip)
        all_clips.append(VideoFileClip(str(scene_mp4)))

    # ── End card ─────────────────────────────────────────────────────────────
    end_frames = make_title_card("A Day at the Park\n\nThe End", n_frames=END_CARD_FRAMES)
    all_clips.append(ImageSequenceClip(end_frames, fps=20))

    # ── FIX 4: Concatenate with short crossfades ─────────────────────────────
    log.info("\n" + "─" * 50)
    log.info("🎞  Concatenating all scenes into final MP4 ...")
    final_path = STORY_OUT / "park_story_final.mp4"

    # Use crossfadein/crossfadeout for subtle transitions
    clips_with_transitions = []
    for i, clip in enumerate(all_clips):
        if i > 0:
            clip = clip.crossfadein(CROSSFADE_S)
        if i < len(all_clips) - 1:
            clip = clip.crossfadeout(CROSSFADE_S)
        clips_with_transitions.append(clip)

    final = concatenate_videoclips(clips_with_transitions, padding=-CROSSFADE_S,
                                   method="compose")
    final.write_videofile(
        str(final_path), fps=20, codec="libx264", audio_codec="aac", logger=None
    )
    final.close()

    # ── Verification ─────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 60)
    verify = VideoFileClip(str(final_path))
    v_dur = verify.duration
    a_dur = verify.audio.duration if verify.audio else 0
    log.info(f"VIDEO DURATION: {v_dur:.2f}s")
    log.info(f"AUDIO DURATION: {a_dur:.2f}s")
    log.info(f"DIFFERENCE:     {abs(v_dur - a_dur):.2f}s")
    log.info(f"RESOLUTION:     {verify.size[0]}x{verify.size[1]}")
    log.info(f"FPS:            {verify.fps}")
    verify.close()
    log.info("=" * 60)
    log.info(f"🎉  Done!  {final_path}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
