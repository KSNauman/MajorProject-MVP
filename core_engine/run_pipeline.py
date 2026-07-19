import os
import sys

# Add the directory containing the script to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from stage3_animate.non_humanoid.bounce_animator import create_bounce_animation

def main():
    print("========================================")
    print("   SKETCH TO ANIMATION CORE ENGINE")
    print("========================================")
    
    if len(sys.argv) < 2:
        print("Usage: python run_pipeline.py <input_image_path>")
        sys.exit(1)
        
    input_image = sys.argv[1]
    
    if not os.path.exists(input_image):
        print(f"[!] Error: Image not found at {input_image}")
        sys.exit(1)
        
    # Setup output paths
    base_name = os.path.basename(input_image).split('.')[0]
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    
    output_gif = os.path.join(output_dir, f"{base_name}_animated.gif")
    
    # PHASE 1 PIPELINE: Bypass classification, jump straight to Fallback Bounce
    print("[*] Stage 1: Preprocessing (Skipped for Phase 1 - Assuming transparent PNG)")
    print("[*] Stage 2: Classification (Skipped for Phase 1)")
    print("[*] Stage 3: Animation (Routing to Non-Humanoid Fallback Method)")
    
    success = create_bounce_animation(input_image, output_gif)
    
    if success:
        print(f"\n[+] Pipeline Finished successfully! Animation saved at: {output_gif}")
    else:
        print("\n[!] Pipeline Failed.")

if __name__ == "__main__":
    main()
