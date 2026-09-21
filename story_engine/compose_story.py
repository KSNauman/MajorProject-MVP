"""
compose_story.py
================
Lightweight story compositor.

This does NOT call animated_drawings.render.start().
It reads pre-cached transparent GIFs and composites them over backgrounds,
then muxes audio and concatenates scenes.
"""

import os
import sys
from imageio_ffmpeg import get_ffmpeg_exe
FFMPEG_BIN = get_ffmpeg_exe()
import json
import subprocess
import time
from pathlib import Path
from PIL import Image, ImageSequence

REPO_ROOT = Path(r"c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings")
CHARACTERS_DIR = Path(r"c:\Major Project - MVP2\Major Project - MVP\characters")
ASSETS_DIR = REPO_ROOT / "assets" / "Rahim's Story"
OUTPUT_DIR = Path(r"c:\Major Project - MVP2\Major Project - MVP\story_engine\output")

# 9-Scene Storyboard
SCENES = [
    {
        "id": 1, "start": 0.13, "end": 2.58,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "rahim", "motion": "idel", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
        ]
    },
    {
        "id": 2, "start": 2.58, "end": 5.16,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
        ]
    },
    {
        "id": 3, "start": 5.16, "end": 7.65,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "sister", "motion": "sleep", "x": 0.45, "y": 0.70, "scale": 0.34, "anchor": "bed"}
        ]
    },
    {
        "id": 4, "start": 7.65, "end": 10.15,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
        ]
    },
    {
        "id": 5, "start": 10.15, "end": 13.57,
        "bg": "bg_kitchen.png",
        "chars": [
            {"slot": "mother",  "motion": "opening",         "x": 0.35, "y": 0.86, "scale": 0.45, "anchor": "floor"},
            {"slot": "grandma", "motion": "walk_in_circle",   "x": 0.65, "y": 0.86, "scale": 0.43, "anchor": "floor"}
        ]
    },
    {
        "id": 6, "start": 13.57, "end": 16.05,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
        ]
    },
    {
        "id": 7, "start": 16.05, "end": 19.62,
        "bg": "bg_study_garden.png",
        "chars": [
            {"slot": "father",  "motion": "opening",         "x": 0.35, "y": 0.86, "scale": 0.45, "anchor": "floor"},
            {"slot": "grandpa", "motion": "walk_in_circle",   "x": 0.65, "y": 0.86, "scale": 0.43, "anchor": "floor"}
        ]
    },
    {
        "id": 8, "start": 19.62, "end": 22.41,
        "bg": "bg_hallway.png",
        "chars": [
            {"slot": "rahim", "motion": "wave", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
        ]
    },
    {
        "id": 9, "start": 22.41, "end": 24.50,
        "bg": "bg_bedroom.png",
        "chars": [
            {"slot": "rahim", "motion": "jump", "x": 0.5, "y": 0.86, "scale": 0.48, "anchor": "floor"}
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
    uploads_path = Path(r"c:\Major Project - MVP2\Major Project - MVP\eduvision_ui\uploads") / char_id
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
    return frames

def compose_scene(scene: dict, characters: dict) -> str:
    sid = scene["id"]
    duration = scene["end"] - scene["start"]
    total_frames = max(1, int(duration * FPS))
    print(f"  Composing Scene {sid}: {duration:.2f}s, {total_frames} frames")

    bg_path = ASSETS_DIR / scene["bg"]
    if bg_path.exists():
        bg_img = Image.open(str(bg_path)).convert("RGBA").resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
    else:
        bg_img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (255, 255, 255, 255))

    char_data = []
    for char_info in scene["chars"]:
        slot = char_info["slot"]
        motion = char_info["motion"]
        char_id = characters.get(slot, "default")
        char_dir = resolve_character_dir(slot, char_id)
        gif_path = char_dir / "animations" / f"{motion}.gif"
        frames = load_gif_frames(gif_path)
        if not frames:
            print(f"    WARNING: No cached GIF for {slot}/{motion} at {gif_path}")
            continue
        char_data.append({
            "frames": frames,
            "x": char_info.get("x", 0.5),
            "y": char_info.get("y", 0.86),
            "scale": char_info.get("scale", 0.4),
            "anchor": char_info.get("anchor", "floor"),
            "slot": slot,
            "motion": motion
        })
        print(f"    Loaded {len(frames)} frames for {slot}/{motion}")

    scene_dir = OUTPUT_DIR / f"scene_{sid}"
    scene_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = scene_dir / "frames"
    frames_dir.mkdir(exist_ok=True)

    for fi in range(total_frames):
        canvas = bg_img.copy()
        for cd in char_data:
            if not cd["frames"]:
                continue
            gif_frame = cd["frames"][fi % len(cd["frames"])]
            char_h = int(CANVAS_H * cd["scale"])
            aspect = gif_frame.width / gif_frame.height
            char_w = int(char_h * aspect)
            if char_w < 1 or char_h < 1:
                continue
            scaled = gif_frame.resize((char_w, char_h), Image.LANCZOS)
            px = int(cd["x"] * CANVAS_W - char_w / 2)
            
            # Position based on semantic anchor
            if cd.get("anchor") in ["floor", "bed", "bottom"]:
                py = int(cd["y"] * CANVAS_H - char_h)
            else:
                py = int(cd["y"] * CANVAS_H - char_h / 2)
                
            canvas.paste(scaled, (px, py), scaled)
        frame_path = frames_dir / f"frame_{fi:04d}.png"
        canvas.convert("RGB").save(str(frame_path))

    scene_video = scene_dir / "scene_video.mp4"
    subprocess.run([
        FFMPEG_BIN, "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", f"scale={CANVAS_W}:{CANVAS_H}",
        scene_video
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    audio_clip = scene_dir / "audio.mp3"
    full_audio = ASSETS_DIR / "rahim_story_audio.mp3"
    subprocess.run([
        FFMPEG_BIN, "-y",
        "-i", str(full_audio),
        "-ss", str(scene["start"]),
        "-t", str(duration),
        str(audio_clip)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    muxed = scene_dir / "scene_muxed.mp4"
    subprocess.run([
        FFMPEG_BIN, "-y",
        "-i", str(scene_video),
        "-i", str(audio_clip),
        "-c:v", "libx264", "-c:a", "aac",
        "-pix_fmt", "yuv420p", "-shortest",
        str(muxed)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return str(muxed)

def main():
    if len(sys.argv) < 2:
        print("Missing payload")
        sys.exit(1)
    payload = json.loads(sys.argv[1])
    characters = payload.get("characters", {})
    story_id = payload.get("storyId", "rahims_story")
    print("=" * 60)
    print(f"EDUVISION Story Compositor - {story_id}")
    print("=" * 60)
    print(f"Characters: {json.dumps(characters, indent=2)}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    start_time = time.time()
    scene_videos = []
    for scene in SCENES:
        print(f"\n--- Scene {scene['id']} ---")
        muxed_path = compose_scene(scene, characters)
        if os.path.exists(muxed_path):
            scene_videos.append(muxed_path)
        else:
            print(f"  ERROR: Scene {scene['id']} failed to produce video")
    print(f"\n--- Concatenating {len(scene_videos)} scenes ---")
    concat_list = OUTPUT_DIR / "concat_list.txt"
    with open(str(concat_list), 'w') as f:
        for vid in scene_videos:
            f.write(f"file '{vid.replace(chr(92), '/')}'\n")
    final_output = OUTPUT_DIR / f"rahims_story_{int(time.time())}.mp4"
    subprocess.run([
        FFMPEG_BIN, "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy",
        str(final_output)
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elapsed = time.time() - start_time
    print(f"\nStory generated in {elapsed:.1f}s: {final_output}")
    if final_output.exists():
        print(f"Final video size: {final_output.stat().st_size / 1024 / 1024:.1f} MB")
    else:
        print("ERROR: Final video was not created")
        sys.exit(1)

if __name__ == "__main__":
    main()
