"""
batch_animate.py
================
Generates all required animation GIFs for a single processed character.

This wraps the EXISTING AnimatedDrawings render engine (animated_drawings.render.start).
It does NOT replace or modify the engine in any way.

Usage:
    python batch_animate.py <char_dir> [--motions idel,wave,jump]

char_dir must contain: char_cfg.yaml, texture.png, mask.png
Outputs go to: char_dir/animations/<motion_name>.gif
"""

import os
import sys
import json
import yaml
import shutil
import argparse
import time
from pathlib import Path

# Add AnimatedDrawings to path
REPO_ROOT = Path(r"c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings")
sys.path.insert(0, str(REPO_ROOT))

import animated_drawings.render

# ── Story-specific BVH motions (from Rahim's Story assets) ──────────────
ASSETS_DIR = REPO_ROOT / "assets" / "Rahim's Story"
BVH_DIR = REPO_ROOT / "examples" / "bvh" / "fair1"

STORY_MOTIONS = {
    "idel":             str(ASSETS_DIR / "idel.bvh"),
    "wave":             str(BVH_DIR / "wave_hello.bvh"),  # using built-in fair1 wave
    "jump":             str(ASSETS_DIR / "jump.bvh"),
    "sleep":            str(ASSETS_DIR / "sleep.bvh"),
    "opening":          str(ASSETS_DIR / "opening.bvh"),
    "walk_in_circle":   str(ASSETS_DIR / "walk in circle.bvh"),
}


def prepare_bvh(bvh_path: str, temp_dir: Path):
    """
    Reads the BVH, determines its format. If it has 'mixamorig:' prefix,
    strips it into a temporary BVH file so AnimatedDrawings' mixamo config works.
    Returns: (temp_bvh_path, groundplane_joint, forward_perp_joints, retarget_yaml, is_mixamo)
    """
    is_mixamo = False
    with open(bvh_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if "mixamorig:" in content:
            is_mixamo = True

    if is_mixamo:
        # Create temp BVH without prefix
        temp_bvh = temp_dir / f"_tmp_{Path(bvh_path).name}"
        with open(temp_bvh, 'w', encoding='utf-8') as f:
            f.write(content.replace("mixamorig:", ""))
            
        return (
            str(temp_bvh),
            "RightToeBase",  # groundplane joint
            [
                ['LeftShoulder', 'RightShoulder'],
                ['LeftUpLeg', 'RightUpLeg']
            ],
            str(REPO_ROOT / "examples" / "config" / "retarget" / "mixamo_custom.yaml"),
            True
        )
    else:
        # FAIR configuration
        return (
            bvh_path,
            "LeftFoot",
            [
                ['LeftShoulder', 'RightShoulder'],
                ['LeftUpLeg', 'RightUpLeg']
            ],
            str(REPO_ROOT / "examples" / "config" / "retarget" / "fair1_ppf.yaml"),
            False
        )


def generate_animation(char_dir: str, motion_name: str, bvh_path: str) -> dict:
    """
    Generate a single transparent-background GIF for a character + motion.
    Returns {"status": "ok"|"cached"|"error", "path": ..., "error": ...}
    """
    char_dir = Path(char_dir)
    anim_dir = char_dir / "animations"
    anim_dir.mkdir(parents=True, exist_ok=True)

    gif_path = anim_dir / f"{motion_name}.gif"

    # Cache check -- skip if already generated
    if gif_path.exists() and gif_path.stat().st_size > 0:
        return {"status": "cached", "path": str(gif_path)}

    char_cfg_path = char_dir / "char_cfg.yaml"
    if not char_cfg_path.exists():
        return {"status": "error", "error": f"Missing char_cfg.yaml in {char_dir}"}

    if not os.path.exists(bvh_path):
        return {"status": "error", "error": f"BVH not found: {bvh_path}"}

    # Auto-detect BVH format and strip prefixes if necessary
    prepared_bvh, gp_joint, fwd_joints, retarget_path, is_mixamo = prepare_bvh(bvh_path, anim_dir)

    # Build motion config
    motion_cfg = {
        'filepath': prepared_bvh.replace('\\', '/'),
        'start_frame_idx': 0,
        'end_frame_idx': 90,
        'groundplane_joint': gp_joint,
        'forward_perp_joint_vectors': fwd_joints,
        'scale': 0.015 if is_mixamo else 0.025,  # Mixamo usually needs smaller scale
        'up': '+y' if is_mixamo else '+z'        # Mixamo is Y-up, FAIR is Z-up
    }

    # Write temp motion config
    temp_motion_path = str(anim_dir / f"_tmp_motion_{motion_name}.yaml")
    with open(temp_motion_path, 'w') as f:
        yaml.dump(motion_cfg, f)

    # Build MVC config -- transparent background, GIF output
    mvc_cfg = {
        'scene': {
            'ANIMATED_CHARACTERS': [{
                'character_cfg': str(char_cfg_path).replace('\\', '/'),
                'motion_cfg': temp_motion_path.replace('\\', '/'),
                'retarget_cfg': retarget_path.replace('\\', '/')
            }],
            'ADD_FLOOR': False,
            'ADD_AD_RETARGET_BVH': False
        },
        'controller': {
            'MODE': 'video_render',
            'OUTPUT_VIDEO_PATH': str(gif_path).replace('\\', '/')
        }
    }

    mvc_path = str(anim_dir / f"_tmp_mvc_{motion_name}.yaml")
    with open(mvc_path, 'w') as f:
        yaml.dump(mvc_cfg, f)

    error_msg = None
    try:
        animated_drawings.render.start(mvc_path)
        if not (gif_path.exists() and gif_path.stat().st_size > 0):
            error_msg = f"Render produced no output for {motion_name}"
    except Exception as e:
        error_msg = str(e)
    finally:
        # Clean up temp files
        for tmp in [temp_motion_path, mvc_path, prepared_bvh]:
            if tmp != bvh_path and os.path.exists(tmp):
                os.remove(tmp)

    if error_msg:
        return {"status": "error", "error": error_msg}
    return {"status": "ok", "path": str(gif_path)}


def batch_generate(char_dir: str, motion_names: list = None):
    """
    Generate all required animations for a character.
    If motion_names is None, generates all STORY_MOTIONS.
    """
    if motion_names is None:
        motion_names = list(STORY_MOTIONS.keys())

    results = {}
    total = len(motion_names)

    for i, name in enumerate(motion_names, 1):
        bvh_path = STORY_MOTIONS.get(name)
        if bvh_path is None:
            results[name] = {"status": "error", "error": f"Unknown motion: {name}"}
            print(f"  [{i}/{total}] SKIP {name} -- unknown motion")
            continue

        print(f"  [{i}/{total}] Generating {name}...", end=" ", flush=True)
        result = generate_animation(char_dir, name, bvh_path)
        results[name] = result
        print(result["status"].upper())

    return results


def write_manifest(char_dir: str, slot_name: str, results: dict):
    """Write a manifest.json tracking cached animations and character metadata."""
    char_dir = Path(char_dir)
    manifest = {
        "slot": slot_name,
        "processed_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "char_cfg": "char_cfg.yaml",
        "texture": "texture.png",
        "mask": "mask.png",
        "animations": {}
    }
    for name, result in results.items():
        if result["status"] in ("ok", "cached"):
            manifest["animations"][name] = f"animations/{name}.gif"
        else:
            manifest["animations"][name] = None  # failed

    with open(char_dir / "manifest.json", 'w') as f:
        json.dump(manifest, f, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch-generate animation GIFs for a character")
    parser.add_argument("char_dir", help="Path to processed character directory (must have char_cfg.yaml)")
    parser.add_argument("--motions", help="Comma-separated motion names (default: all story motions)")
    parser.add_argument("--slot", default="unknown", help="Character slot name for manifest")
    args = parser.parse_args()

    motions = args.motions.split(",") if args.motions else None

    print(f"Batch animating: {args.char_dir}")
    results = batch_generate(args.char_dir, motions)
    write_manifest(args.char_dir, args.slot, results)

    # Summary
    ok = sum(1 for r in results.values() if r["status"] in ("ok", "cached"))
    fail = sum(1 for r in results.values() if r["status"] == "error")
    print(f"\nDone: {ok} succeeded, {fail} failed")

    if fail > 0:
        for name, r in results.items():
            if r["status"] == "error":
                print(f"  FAILED: {name} -- {r['error']}")
