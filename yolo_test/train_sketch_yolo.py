import os
import shutil
from pathlib import Path
from ultralytics import YOLO

def train_custom_sketch_model(dataset_yaml_path, epochs=50, batch_size=16, imgsz=640):
    print("==================================================")
    print("   TRAINING CUSTOM SKETCH YOLOv8-POSE MODEL")
    print("==================================================")
    
    if not os.path.exists(dataset_yaml_path):
        print(f"[!] Dataset YAML not found at: {dataset_yaml_path}")
        print("[!] Please run `python convert_amateur_drawings_to_yolo.py` first!")
        return False
        
    print(f"[*] Loading pretrained base model: yolov8n-pose.pt...")
    model = YOLO('yolov8n-pose.pt')
    
    print(f"[*] Starting fine-tuning for {epochs} epochs...")
    results = model.train(
        data=dataset_yaml_path,
        epochs=epochs,
        imgsz=imgsz,
        batch=batch_size,
        device=0 if os.getenv("CUDA_VISIBLE_DEVICES") else 'cpu',
        project='sketch_pose_runs',
        name='sketch_yolov8',
        save=True
    )
    
    # Locate best weights
    runs_dir = Path('sketch_pose_runs/sketch_yolov8/weights/best.pt')
    target_weights = Path('c:/MajorProject-MVP/MajorProject-MVP/yolo_test/sketch_yolov8_pose.pt')
    
    if runs_dir.exists():
        shutil.copy(runs_dir, target_weights)
        print(f"\n[+] SUCCESS! Fine-tuned sketch model saved to: {target_weights.resolve()}")
        return True
    else:
        print("\n[!] Could not locate best weights file after training.")
        return False

if __name__ == "__main__":
    yaml_path = "c:/MajorProject-MVP/MajorProject-MVP/yolo_test/sketch_yolo_dataset/sketch_pose_dataset.yaml"
    train_custom_sketch_model(yaml_path, epochs=50)
