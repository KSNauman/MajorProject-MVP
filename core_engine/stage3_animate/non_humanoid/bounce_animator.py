import os
import math
from PIL import Image
import imageio.v3 as iio
import numpy as np

def create_bounce_animation(image_path, output_path, num_frames=60, duration=3.0):
    """
    Creates a subtle 'breathing' and 'floating' animation GIF.
    This provides minimal, elegant movement for non-humanoid objects.
    """
    print(f"[*] Starting subtle animation for {image_path}")
    try:
        img = Image.open(image_path).convert("RGBA")
    except Exception as e:
        print(f"[!] Error opening image: {e}")
        return False

    width, height = img.size
    frames = []

    # Canvas slightly larger to allow for gentle movement
    canvas_w = int(width * 1.2)
    canvas_h = int(height * 1.2)
    
    # Base center position
    base_x = (canvas_w - width) // 2
    base_y = (canvas_h - height) // 2

    print(f"[*] Generating {num_frames} frames of minimal movement...")
    for i in range(num_frames):
        progress = i / num_frames
        
        # 1. Subtle Floating (moves up and down by just 2% of height)
        float_amplitude = height * 0.02
        y_offset = int(math.sin(progress * math.pi * 2) * float_amplitude)
        
        # 2. Subtle Breathing (scales width and height by +/- 1.5%)
        # Using cosine so it breathes out at the top of the float
        breath_amplitude = 0.015 
        scale_factor = 1.0 + (math.cos(progress * math.pi * 2) * breath_amplitude)
        
        new_w = int(width * scale_factor)
        new_h = int(height * scale_factor)
        
        # Smooth high-quality resize
        resized_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Create a blank transparent frame
        frame = Image.new("RGBA", (canvas_w, canvas_h), (255, 255, 255, 0))
        
        # Calculate centered paste position with the float offset
        paste_x = base_x - ((new_w - width) // 2)
        paste_y = base_y - ((new_h - height) // 2) + y_offset
        
        # Paste the character
        frame.paste(resized_img, (paste_x, paste_y), resized_img)
        frames.append(np.array(frame))

    # Save as GIF
    frame_duration = (duration * 1000) / num_frames 
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"[*] Saving subtle animation to {output_path}")
    iio.imwrite(output_path, frames, duration=frame_duration, loop=0)
    print("[+] Minimal movement animation completed successfully!")
    return True

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python bounce_animator.py <input_image.png> <output.gif>")
    else:
        create_bounce_animation(sys.argv[1], sys.argv[2])
