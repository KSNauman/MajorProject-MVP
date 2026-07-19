import cv2
import torch
import urllib.request
import numpy as np
import imageio
import os

import sys

def create_example(filename, output_gif):
    print(f"Processing image: {filename}")
    
    # 1. Load image and handle alpha channel properly
    img_bgr = cv2.imread(filename, cv2.IMREAD_UNCHANGED)
    
    if img_bgr is None:
        print(f"Error: Could not load image at {filename}")
        return

    # Resize to a reasonable dimension (max 600px width/height) to avoid 500MB GIFs
    max_dim = 600
    h, w = img_bgr.shape[:2]
    scale = min(max_dim/w, max_dim/h)
    new_w, new_h = int(w * scale), int(h * scale)
    img_bgr = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    # Composite onto white background if it has transparency
    if img_bgr.shape[2] == 4:
        alpha = img_bgr[:, :, 3] / 255.0
        img = np.ones((new_h, new_w, 3), dtype=np.uint8) * 255
        for c in range(3):
            img[:, :, c] = (alpha * img_bgr[:, :, c] + (1 - alpha) * 255).astype(np.uint8)
    else:
        img = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) if img_bgr.shape[2] != 4 else img
    h, w = img.shape[:2]

    print(f"Resized image to {w}x{h} to keep GIF size small...")

    print("Loading MiDaS depth model (Small, 4GB VRAM optimized)...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    midas = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", trust_repo=True)
    midas.to(device)
    midas.eval()

    midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
    transform = midas_transforms.small_transform

    print("Estimating 3D depth...")
    input_batch = transform(img).to(device)

    with torch.no_grad():
        prediction = midas(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    output = prediction.cpu().numpy()
    
    # Normalize depth map to 0-1
    depth_min = output.min()
    depth_max = output.max()
    if depth_max > depth_min:
        depth_map = (output - depth_min) / (depth_max - depth_min)
    else:
        depth_map = np.zeros_like(output)
        
    # Amplify the contrast of the depth map so foreground pops out more aggressively
    depth_map = np.clip(depth_map ** 0.5, 0, 1)

    print("Generating 2.5D Parallax frames...")
    frames = []
    num_frames = 45 # fewer frames for smaller file size
    
    # Increase maximum shift amount to make it very noticeable
    shift_max_x = w * 0.08 # 8% shift
    shift_max_y = h * 0.04 # 4% shift

    x, y = np.meshgrid(np.arange(w), np.arange(h))
    x = x.astype(np.float32)
    y = y.astype(np.float32)

    for i in range(num_frames):
        progress = i / num_frames
        
        shift_x = np.sin(progress * 2 * np.pi) * shift_max_x
        shift_y = np.cos(progress * 2 * np.pi) * shift_max_y
        
        map_x = x - (shift_x * depth_map)
        map_y = y - (shift_y * depth_map)
        
        frame = cv2.remap(img, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        frames.append(frame)

    print("Saving optimized GIF...")
    # Use imageio to save with better compression
    imageio.mimsave(output_gif, frames, fps=15)
    print(f"Done! Check out {output_gif}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python parallax_example.py <input_image> <output_gif>")
    else:
        create_example(sys.argv[1], sys.argv[2])
