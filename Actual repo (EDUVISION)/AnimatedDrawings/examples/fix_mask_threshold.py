import cv2
import numpy as np
from PIL import Image
import os

def main():
    # We should read 'texture.png' from the output folder since it has the cropped/resized character
    # that matches the dimension specified in char_cfg.yaml.
    char_anno_dirs = ['examples/test3_out', 'test3_out', 'annotations_test3']
    texture_path = None
    mask_path = None
    
    for d in char_anno_dirs:
        if os.path.exists(os.path.join(d, 'texture.png')):
            texture_path = os.path.join(d, 'texture.png')
            mask_path = os.path.join(d, 'mask.png')
            break
            
    if not texture_path:
        print("Error: Could not find texture.png in any expected output directory!")
        return

    print(f"Reading texture from: {texture_path}")
    img = Image.open(texture_path)
    arr = np.array(img.convert("RGBA"))
    
    # Check if we have alpha transparency (transparency is black in mask)
    alpha = arr[:,:,3]
    if np.any(alpha < 255):
        # Background pixels are transparent (alpha < 10)
        not_bg = alpha > 10
    else:
        # Background is white (R,G,B close to 255)
        # We threshold anything that is NOT white
        not_bg = ~((arr[:,:,0] > 240) & (arr[:,:,1] > 240) & (arr[:,:,2] > 240))
        
    mask_arr = (not_bg * 255).astype(np.uint8)
    
    # Apply dilation to keep thin lines (like arms/legs) connected
    kernel = np.ones((3,3), np.uint8)
    dilated_mask = cv2.dilate(mask_arr, kernel, iterations=1)
    
    mask_img = Image.fromarray(dilated_mask)
    mask_img.save(mask_path)
    print(f"Successfully generated a threshold-based mask at {mask_path} (size: {mask_img.size})!")

if __name__ == '__main__':
    main()
