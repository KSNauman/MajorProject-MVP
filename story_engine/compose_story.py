"""
compose_story.py
================
Lightweight story compositor.

This does NOT call animated_drawings.render.start().
It reads pre-cached transparent GIFs, composites them over backgrounds and
streams the frames with the narration into a single FFmpeg encode.
"""

import os
import sys
from imageio_ffmpeg import get_ffmpeg_exe
FFMPEG_BIN = get_ffmpeg_exe()
import json
import subprocess
import time
from progress_logger import ProgressLogger
from pathlib import Path
from PIL import Image, ImageSequence

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR / "Actual repo (EDUVISION)" / "AnimatedDrawings"
CHARACTERS_DIR = BASE_DIR / "characters"
ASSETS_DIR = REPO_ROOT / "assets" / "Rahim's Story"
OUTPUT_DIR = BASE_DIR / "story_engine" / "output"

# 9-Scene Storyboard
SCENES = [
    {
        "id": 1, "start": 0.13, "end": 2.58,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "rahim", "motion": "idel", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    },
    {
        "id": 2, "start": 2.58, "end": 5.16,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    },
    {
        "id": 3, "start": 5.16, "end": 7.65,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "sister", "motion": "sleep", "x": 0.45, "y": 0.70, "scale": 0.28, "anchor": "floor"}
        ]
    },
    {
        "id": 4, "start": 7.65, "end": 10.15,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    },
    {
        "id": 5, "start": 10.15, "end": 13.57,
        "bg": "bg_kitchen.png",
        "chars": [
            {"slot": "mother",  "motion": "opening",         "x": 0.35, "y": 0.86, "scale": 0.35, "anchor": "floor"},
            {"slot": "grandma", "motion": "walk_in_circle",   "x": 0.65, "y": 0.86, "scale": 0.32, "anchor": "floor"}
        ]
    },
    {
        "id": 6, "start": 13.57, "end": 16.05,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    },
    {
        "id": 7, "start": 16.05, "end": 19.62,
        "bg": "bg_study_garden.png",
        "chars": [
            {"slot": "father",  "motion": "opening",         "x": 0.35, "y": 0.86, "scale": 0.35, "anchor": "floor"},
            {"slot": "grandpa", "motion": "walk_in_circle",   "x": 0.65, "y": 0.86, "scale": 0.32, "anchor": "floor"}
        ]
    },
    {
        "id": 8, "start": 19.62, "end": 22.41,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    },
    {
        "id": 9, "start": 22.41, "end": 23.88,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "rahim", "motion": "jump", "x": 0.5, "y": 0.86, "scale": 0.29, "anchor": "floor"}
        ]
    }
]
CANVAS_W, CANVAS_H = 1280, 720
FPS = 24

def resolve_character_dir(slot: str, char_id: str) -> Path:
    if char_id == "default" or char_id == slot:
        return CHARACTERS_DIR / slot
    custom_path = CHARACTERS_DIR / char_id
    if custom_path.exists():
        return custom_path
    uploads_path = (BASE_DIR / "eduvision_ui" / "uploads") / char_id
    if uploads_path.exists():
        return uploads_path
    return CHARACTERS_DIR / slot

def load_gif_frames(gif_path: Path) -> list:
    if not gif_path.exists():
        return []
    img = Image.open(str(gif_path))
    frames = []
    try:
        for frame in ImageSequence.Iterator(img):
            frames.append(frame.convert("RGBA"))
    except EOFError:
        pass
        
    union_bbox = None
    for frame in frames:
        bbox = frame.getbbox()
        if bbox:
            if union_bbox is None:
                union_bbox = list(bbox)
            else:
                union_bbox[0] = min(union_bbox[0], bbox[0])
                union_bbox[1] = min(union_bbox[1], bbox[1])
                union_bbox[2] = max(union_bbox[2], bbox[2])
                union_bbox[3] = max(union_bbox[3], bbox[3])
                
    if union_bbox:
        return [f.crop(union_bbox) for f in frames]
    return frames

def load_sprites(slot: str, motion: str, scale: float, characters: dict, cache: dict) -> list:
    """Load a character's GIF once and resize it once, reused by every scene that needs it."""
    key = (slot, motion, scale)
    if key not in cache:
        char_id = characters.get(slot, "default")
        gif_path = resolve_character_dir(slot, char_id) / "animations" / f"{motion}.gif"
        frames = load_gif_frames(gif_path)
        if not frames:
            print(f"    WARNING: No cached GIF for {slot}/{motion} at {gif_path}")
        char_h = int(CANVAS_H * scale)
        sprites = []
        for frame in frames:
            char_w = int(char_h * frame.width / frame.height)
            if char_w >= 1 and char_h >= 1:
                sprites.append(frame.resize((char_w, char_h), Image.LANCZOS))
        cache[key] = sprites
        print(f"    Loaded {len(sprites)} frames for {slot}/{motion}")
    return cache[key]

def write_scene(scene: dict, characters: dict, sprite_cache: dict, video_pipe, logger=None) -> None:
    """Composite one scene and stream its raw frames into the running FFmpeg encode."""
    sid = scene["id"]
    # Frame numbers come from absolute times so the picture cannot drift from the narration.
    total_frames = max(1, round(scene["end"] * FPS) - round(scene["start"] * FPS))
    print(f"  Composing Scene {sid}: {scene['end'] - scene['start']:.2f}s, {total_frames} frames")
    if logger: logger.log_stage("SCENE_PREPARATION", f"Preparing scene {sid}", scene=sid)
    if logger: logger.start_timer(f"scene_{sid}")

    bg_path = ASSETS_DIR / scene["bg"]
    if bg_path.exists():
        bg_img = Image.open(str(bg_path)).convert("RGB").resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
    else:
        bg_img = Image.new("RGB", (CANVAS_W, CANVAS_H), (255, 255, 255))

    layers = []
    for char_info in scene["chars"]:
        sprites = load_sprites(char_info["slot"], char_info["motion"], char_info.get("scale", 0.4), characters, sprite_cache)
        if sprites:
            layers.append((char_info, sprites))

    for fi in range(total_frames):
        canvas = bg_img.copy()
        for char_info, sprites in layers:
            sprite = sprites[fi % len(sprites)]
            px = int(char_info.get("x", 0.5) * CANVAS_W - sprite.width / 2)
            base_y = char_info.get("y", 0.86) * CANVAS_H

            # Position based on semantic anchor
            if char_info.get("anchor", "floor") in ["floor", "bottom"]:
                py = int(base_y - sprite.height)
            else:
                py = int(base_y - sprite.height / 2)

            canvas.paste(sprite, (px, py), sprite)
        video_pipe.write(canvas.tobytes())
    if logger: logger.end_timer(f"scene_{sid}")

def main():
    if len(sys.argv) < 2:
        print("Missing payload")
        sys.exit(1)
    payload = json.loads(sys.argv[1])
    characters = payload.get("characters", {})
    story_id = payload.get("storyId", "rahims_story")
    job_id = sys.argv[2] if len(sys.argv) > 2 else "unknown_job"
    logger = ProgressLogger(job_id, "Compositor")
    logger.log_stage("STARTING", "Initializing Story Compositor")
    logger.start_timer("total_story")
    print("=" * 60)
    print(f"EDUVISION Story Compositor - {story_id}")
    print("=" * 60)
    print(f"Characters: {json.dumps(characters, indent=2)}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    start_time = time.time()

    # Written under a temporary name so the gallery never lists a half-finished video.
    final_output = OUTPUT_DIR / f"rahims_story_{int(time.time() * 1000)}.mp4"
    partial_output = final_output.with_suffix(".part")
    story_start, story_end = SCENES[0]["start"], SCENES[-1]["end"]
    ffmpeg = subprocess.Popen([
        FFMPEG_BIN, "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{CANVAS_W}x{CANVAS_H}", "-r", str(FPS), "-i", "-",
        "-ss", str(story_start), "-t", str(story_end - story_start), "-i", str(ASSETS_DIR / "rahim_story_audio.mp3"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
        "-movflags", "+faststart", "-f", "mp4", str(partial_output)
    ], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    sprite_cache = {}
    try:
        for scene in SCENES:
            print(f"\n--- Scene {scene['id']} ---")
            write_scene(scene, characters, sprite_cache, ffmpeg.stdin, logger)
        logger.log_stage("COMPOSITING", "Finishing final video")
        ffmpeg.stdin.close()
    except OSError:
        pass  # FFmpeg stopped early; its exit code and message are reported below
    except Exception:
        ffmpeg.kill()
        ffmpeg.wait()
        partial_output.unlink(missing_ok=True)
        raise
    ffmpeg_errors = ffmpeg.stderr.read().decode(errors="replace")
    ffmpeg.wait()

    if ffmpeg.returncode != 0 or not partial_output.exists():
        partial_output.unlink(missing_ok=True)
        logger.log_error("Final video was not created", ffmpeg_errors)
        sys.exit(1)

    os.replace(partial_output, final_output)
    elapsed = time.time() - start_time
    print(f"\nStory generated in {elapsed:.1f}s: {final_output}")
    logger.end_timer("total_story")
    logger.log_stage("COMPLETED", "Final video created")
    print(json.dumps({"finalVideoUrl": "/api/files?path=" + str(final_output).replace(chr(92), '/')}))

if __name__ == "__main__":
    main()
