"""
preprocess_defaults.py
======================
One-time script to process all 6 default characters for Rahim's Story.

For each character:
  1. Runs the EXISTING image_to_annotations.py → char_cfg.yaml, texture.png, mask.png
  2. Copies results into characters/{slot}/
  3. Runs batch_animate.py → generates all required animation GIFs
  4. Writes manifest.json

After this runs once, story generation never needs to re-process these characters.

Usage:
    python preprocess_defaults.py
"""

import os
import sys
import subprocess
import shutil
import json
from pathlib import Path

REPO_ROOT = Path(r"c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings")
CHARACTERS_DIR = Path(r"c:\Major Project - MVP2\Major Project - MVP\characters")
ASSETS_DIR = REPO_ROOT / "assets" / "Rahim's Story"
STORY_ENGINE_DIR = Path(r"c:\Major Project - MVP2\Major Project - MVP\story_engine")

DEFAULTS = {
    'rahim':  'rahim_default .png',   # note the space — that's the actual filename
    'sister': 'sister_default.png',
    'mother': 'mother_default.png',
    'father': 'father_default.png',
    'grandma': 'grandma_default.png',
    'grandpa': 'grandpa_default.png',
}


def process_character(slot: str, image_filename: str):
    """Process a single default character through the existing pipeline."""
    img_path = ASSETS_DIR / image_filename
    char_dir = CHARACTERS_DIR / slot

    print(f"\n{'='*60}")
    print(f"Processing: {slot}")
    print(f"Source: {img_path}")
    print(f"Output: {char_dir}")
    print(f"{'='*60}")

    if not img_path.exists():
        print(f"  ERROR: Source image not found: {img_path}")
        return False

    # Check if already fully processed
    manifest_path = char_dir / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
        anims = manifest.get("animations", {})
        if anims and all(v is not None for v in anims.values()):
            print(f"  CACHED: {slot} is already fully processed. Skipping.")
            return True

    # Create character directory
    char_dir.mkdir(parents=True, exist_ok=True)

    # Copy source image for reference
    shutil.copy2(str(img_path), str(char_dir / "source_image.png"))

    # ── Phase 1: Run existing image_to_annotations.py ────────────────
    # This is the SAME script the Fixer uses. We are not modifying it.
    script_path = REPO_ROOT / "examples" / "image_to_annotations.py"

    print(f"  Phase 1: Running image_to_annotations.py...")
    result = subprocess.run(
        [sys.executable, str(script_path), str(img_path), str(char_dir)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"  ERROR Phase 1 failed for {slot}:")
        print(f"  {result.stderr[:500]}")
        return False

    # Verify outputs
    required_files = ['char_cfg.yaml', 'texture.png', 'mask.png']
    for f in required_files:
        if not (char_dir / f).exists():
            print(f"  ERROR: Phase 1 did not produce {f}")
            return False

    print(f"  Phase 1 complete: char_cfg.yaml, texture.png, mask.png generated")

    # ── Phase 2: Batch-generate animation GIFs ───────────────────────
    print(f"  Phase 2: Batch-generating animation GIFs...")
    result = subprocess.run(
        [sys.executable, str(STORY_ENGINE_DIR / "batch_animate.py"),
         str(char_dir), "--slot", slot],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True
    )

    print(result.stdout)
    if result.stderr:
        print(f"  WARNINGS: {result.stderr[:300]}")

    if result.returncode != 0:
        print(f"  ERROR Phase 2 failed for {slot}")
        return False

    print(f"  Phase 2 complete for {slot}")
    return True


def main():
    print("=" * 60)
    print("EDUVISION — Default Character Preprocessor")
    print("=" * 60)
    print(f"Characters dir: {CHARACTERS_DIR}")
    print(f"Assets dir:     {ASSETS_DIR}")
    print(f"Repo root:      {REPO_ROOT}")

    CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)

    results = {}
    for slot, filename in DEFAULTS.items():
        success = process_character(slot, filename)
        results[slot] = "OK" if success else "FAILED"

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for slot, status in results.items():
        print(f"  {slot:12s} -> {status}")

    failed = sum(1 for s in results.values() if s == "FAILED")
    if failed > 0:
        print(f"\n{failed} character(s) failed. Story generation will use fallback for those.")
    else:
        print("\nAll characters processed successfully!")


if __name__ == "__main__":
    main()
