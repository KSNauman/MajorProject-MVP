import sys
import cv2
import numpy as np

# Try to import rembg, if not available, we will fallback to a simple dummy mask
try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False
    print("Warning: rembg not installed. Using fallback thresholding.", file=sys.stderr)

def process_image(input_path, output_path):
    img = cv2.imread(input_path)
    if img is None:
        print(f"Error: Could not read image {input_path}")
        sys.exit(1)
        
    if REMBG_AVAILABLE:
        # Use rembg
        with open(input_path, "rb") as f:
            input_data = f.read()
        output_data = remove(input_data)
        with open(output_path, "wb") as f:
            f.write(output_data)
    else:
        # Fallback: Simple thresholding (just for MVP if rembg is missing)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        
        # Add alpha channel
        b, g, r = cv2.split(img)
        rgba = [b, g, r, mask]
        img_with_alpha = cv2.merge(rgba)
        cv2.imwrite(output_path, img_with_alpha)
        
    print(output_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python rembg_api.py <input_path> <output_path>")
        sys.exit(1)
    process_image(sys.argv[1], sys.argv[2])
