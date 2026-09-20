import sys
import os
import subprocess
import json
import time
import shutil

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing image path"}))
        sys.exit(1)
        
    img_path = sys.argv[1]
    motion = sys.argv[2] if len(sys.argv) > 2 else "dance"
    
    repo_root = r'c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings'
    upload_dir = os.path.dirname(img_path)
    
    # Create a unique output directory for this character
    char_id = str(int(time.time()))
    char_dir = os.path.join(upload_dir, f'char_data_{char_id}')
    os.makedirs(char_dir, exist_ok=True)
    
    extract_script = os.path.join(repo_root, 'examples', 'image_to_annotations.py')
    animate_script = os.path.join(repo_root, 'examples', 'annotations_to_animation.py')
    
    # 1. Run extraction
    # Note: image_to_annotations expects img_path and out_dir
    extract_proc = subprocess.run(
        [sys.executable, extract_script, img_path, char_dir],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    if extract_proc.returncode != 0:
        print(json.dumps({"error": "Extraction failed", "details": extract_proc.stderr}))
        sys.exit(1)
        
    # Apply custom keypoints if provided
    kps_arg = sys.argv[3].strip('"') if len(sys.argv) > 3 else "none"
    if kps_arg != "none" and os.path.exists(kps_arg):
        try:
            import yaml
            # Load custom keypoints
            with open(kps_arg, 'r') as f:
                custom_kps = json.load(f)
                
            # Load bounding box offset
            bbox_path = os.path.join(char_dir, 'bounding_box.yaml')
            if os.path.exists(bbox_path):
                with open(bbox_path, 'r') as f:
                    bbox = yaml.safe_load(f)
                left = bbox.get('left', 0)
                top = bbox.get('top', 0)
                
                # Load char_cfg.yaml
                char_cfg_path = os.path.join(char_dir, 'char_cfg.yaml')
                with open(char_cfg_path, 'r') as f:
                    char_cfg = yaml.safe_load(f)
                
                # Replace skeleton locations
                # We need to map the custom_kps into char_cfg format
                new_skeleton = []
                for kp in custom_kps:
                    new_skeleton.append({
                        "loc": [int(kp['x'] - left), int(kp['y'] - top)],
                        "name": kp['name'],
                        "parent": kp['parent']
                    })
                
                char_cfg['skeleton'] = new_skeleton
                
                # Save modified char_cfg
                with open(char_cfg_path, 'w') as f:
                    yaml.dump(char_cfg, f)
                    
            # Cleanup temp file
            os.remove(kps_arg)
        except Exception as e:
            # If applying custom keypoints fails, just proceed with generated ones
            print(json.dumps({"warning": f"Failed to apply custom keypoints: {str(e)}"}))
            
    # 2. Run animation
    motion_yaml = f'examples/config/motion/{motion}.yaml'
    retarget_yaml = 'examples/config/retarget/fair1_ppf.yaml'
    
    animate_proc = subprocess.run(
        [sys.executable, animate_script, char_dir, motion_yaml, retarget_yaml],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    if animate_proc.returncode != 0:
        print(json.dumps({"error": "Animation failed", "details": animate_proc.stderr}))
        sys.exit(1)
        
    # 3. Find the output video (usually video.gif or video.mp4)
    gif_path = os.path.join(char_dir, 'video.gif')
    mp4_path = os.path.join(char_dir, 'video.mp4')
    
    out_vid = None
    if os.path.exists(gif_path):
        out_vid = gif_path
    elif os.path.exists(mp4_path):
        out_vid = mp4_path
        
    if not out_vid:
        print(json.dumps({"error": "No output video generated"}))
        sys.exit(1)
        
    # Move it to a public URL
    ext = os.path.splitext(out_vid)[1]
    final_filename = f'animation_{char_id}{ext}'
    final_path = os.path.join(upload_dir, final_filename)
    shutil.copy2(out_vid, final_path)
    
    print(json.dumps({
        "success": True, 
        "videoUrl": f"/uploads/{final_filename}",
        "charDir": char_dir
    }))

if __name__ == '__main__':
    main()
