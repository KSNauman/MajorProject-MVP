import cv2
from ultralytics import YOLO
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_yolo.py <path_to_image>")
        sys.exit(1)

    img_path = sys.argv[1]
    if not Path(img_path).exists():
        print(f"Error: Could not find image at {img_path}")
        sys.exit(1)
    
    print(f"Loading YOLOv8 Nano model...")
    # Load the pretrained YOLOv8 Nano model
    model = YOLO('yolov8n.pt')
    
    print(f"Running inference on {img_path}...")
    # Run inference
    results = model(img_path)
    
    # The results object has a built-in plot() method that draws the bounding boxes and labels
    annotated_img = results[0].plot()
    
    # Save the output image
    output_path = "yolo_output.jpg"
    cv2.imwrite(output_path, annotated_img)
    print(f"Success! Saved visualization to {Path(output_path).resolve()}")

if __name__ == "__main__":
    main()
