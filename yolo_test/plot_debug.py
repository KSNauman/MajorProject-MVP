import cv2
import json

def plot_debug_image():
    # Load JSON annotations
    with open('yolo_test/sketch_coco_dataset/annotations.json', 'r') as f:
        data = json.load(f)
        
    # Find annotation for 9944
    img_meta = [i for i in data['images'] if i['id'] == 9944][0]
    ann = [a for a in data['annotations'] if a['image_id'] == 9944][0]
    
    # Load image
    img_path = 'yolo_test/sketch_coco_dataset/9944.png'
    img = cv2.imread(img_path)
    
    # Draw scaled bbox
    bbox = ann['bbox']
    x, y, w, h = [int(val) for val in bbox]
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 255, 0), 2)
    
    # Draw scaled keypoints
    kpts = ann['keypoints']
    for i in range(0, len(kpts), 3):
        kx, ky, kv = kpts[i:i+3]
        if kv > 0:
            cv2.circle(img, (int(kx), int(ky)), 3, (0, 0, 255), -1)
            
    # Save debug image
    out_path = 'C:/Users/ksnau/.gemini/antigravity-ide/brain/738246ce-d6df-4986-9a54-63b506a7c2b5/debug_9944.png'
    cv2.imwrite(out_path, img)
    print(f"[+] Saved debug image with annotations plotted to: {out_path}")

if __name__ == '__main__':
    plot_debug_image()
