"""
run_pipeline.py
---------------
EduVision Core Engine — End-to-End Pipeline

Flow:
  1. Classify the input sketch with Gemini Vision (humanoid / wheeled / unknown)
  2a. Humanoid -> YOLO best.pt pose detection -> skeleton overlay output
  2b. Wheeled  -> bounce animator (unchanged)
  2c. Unknown  -> fallback bounce animator

Usage:
  python run_pipeline.py <input_image_path>
"""

import os
import sys
from pathlib import Path

# Ensure core_engine root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    print("=" * 50)
    print("   EDUVISION CORE ENGINE")
    print("=" * 50)

    if len(sys.argv) < 2:
        print("Usage: python run_pipeline.py <input_image_path>")
        sys.exit(1)

    input_image = " ".join(sys.argv[1:])

    if not os.path.exists(input_image):
        print(f"[!] Error: Image not found at: {input_image}")
        sys.exit(1)

    print(f"\n[Pipeline] Input: {input_image}")

    # ── Stage 1: Classify ────────────────────────────────────────────────────
    print("\n[Stage 1] Classifying sketch with Gemini Vision...")
    import importlib, types
    spec = importlib.util.spec_from_file_location(
        "gemini_brain",
        Path(__file__).resolve().parent / "2_classify" / "gemini_brain.py"
    )
    gemini_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gemini_mod)
    analyze_image = gemini_mod.analyze_image

    classification = analyze_image(input_image)

    if classification is None:
        print("[!] Gemini classification failed. Falling back to bounce animator.")
        is_humanoid = False
        is_wheeled  = False
    else:
        is_humanoid = classification.get("is_humanoid", False)
        is_wheeled  = classification.get("is_wheeled",  False)
        print(f"[Stage 1] Result: humanoid={is_humanoid}, wheeled={is_wheeled}")

    # ── Stage 2: Animate ─────────────────────────────────────────────────────
    if is_humanoid:
        print("\n[Stage 2] Humanoid detected -> Running YOLO best.pt pose estimation...")
        from stage3_animate.humanoid.robust_animator import animate_humanoid
        result = animate_humanoid(input_image)

        if result["success"]:
            print(f"\n[Pipeline] Done!")
            print(f"  Skeleton image : {result['output_image']}")
            print(f"  Joints detected: {result['detected_joints']}/17")
        else:
            print("[Pipeline] Humanoid animation failed — no figure detected.")

    elif is_wheeled:
        print("\n[Stage 2] Wheeled vehicle detected -> Running bounce animator...")
        base_name  = Path(input_image).stem
        output_dir = Path(__file__).resolve().parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_gif = str(output_dir / f"{base_name}_animated.gif")

        from stage3_animate.non_humanoid.bounce_animator import create_bounce_animation
        success = create_bounce_animation(input_image, output_gif)

        if success:
            print(f"\n[Pipeline] Done! Animation saved: {output_gif}")
        else:
            print("[Pipeline] Bounce animation failed.")

    else:
        print("\n[Stage 2] Unknown sketch type -> Falling back to bounce animator...")
        base_name  = Path(input_image).stem
        output_dir = Path(__file__).resolve().parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_gif = str(output_dir / f"{base_name}_animated.gif")

        from stage3_animate.non_humanoid.bounce_animator import create_bounce_animation
        create_bounce_animation(input_image, output_gif)


if __name__ == "__main__":
    main()
