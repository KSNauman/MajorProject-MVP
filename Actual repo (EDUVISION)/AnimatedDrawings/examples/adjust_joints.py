import os
import sys
import argparse
import yaml
import cv2
from pathlib import Path

def load_yaml(path):
    with open(path, 'r') as f:
        return yaml.safe_load(f)

def save_yaml(path, data):
    with open(path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False)

def update_joint_overlay(char_dir):
    char_cfg_path = os.path.join(char_dir, 'char_cfg.yaml')
    texture_path = os.path.join(char_dir, 'texture.png')
    overlay_path = os.path.join(char_dir, 'joint_overlay.png')
    
    if not os.path.exists(char_cfg_path) or not os.path.exists(texture_path):
        print(f"Error: Missing char_cfg.yaml or texture.png in {char_dir}")
        return
        
    cfg = load_yaml(char_cfg_path)
    img = cv2.imread(texture_path)
    if img is None:
        print(f"Error: Could not read texture image from {texture_path}")
        return
        
    joint_overlay = img.copy()
    for joint in cfg['skeleton']:
        x, y = joint['loc']
        name = joint['name']
        # Draw a white circle with black outline
        cv2.circle(joint_overlay, (int(x), int(y)), 7, (255, 255, 255), -1)
        cv2.circle(joint_overlay, (int(x), int(y)), 7, (0, 0, 0), 2)
        # Draw text label with shadow
        cv2.putText(joint_overlay, name, (int(x), int(y + 18)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(joint_overlay, name, (int(x), int(y + 18)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        
    cv2.imwrite(overlay_path, joint_overlay)
    print(f"Updated visual joint overlay at: {overlay_path}")

def main():
    parser = argparse.ArgumentParser(description="Tweak and visualize joint positions in char_cfg.yaml")
    parser.add_argument('char_dir', type=str, help="Path to character folder (e.g. examples/test3_out)")
    parser.add_argument('--joint', type=str, help="Name of joint to modify (e.g. neck, root, right_hand)")
    parser.add_argument('--x', type=int, help="New X coordinate for the joint")
    parser.add_argument('--y', type=int, help="New Y coordinate for the joint")
    parser.add_argument('--dx', type=int, help="X coordinate offset (shift left/right)")
    parser.add_argument('--dy', type=int, help="Y coordinate offset (shift up/down)")
    
    args = parser.parse_args()
    
    char_cfg_path = os.path.join(args.char_dir, 'char_cfg.yaml')
    if not os.path.exists(char_cfg_path):
        print(f"Error: {char_cfg_path} does not exist.")
        sys.exit(1)
        
    cfg = load_yaml(char_cfg_path)
    
    if args.joint:
        joint_found = False
        for joint in cfg['skeleton']:
            if joint['name'] == args.joint:
                joint_found = True
                curr_x, curr_y = joint['loc']
                
                # Apply absolute overrides
                new_x = args.x if args.x is not None else curr_x
                new_y = args.y if args.y is not None else curr_y
                
                # Apply relative offsets
                if args.dx is not None:
                    new_x += args.dx
                if args.dy is not None:
                    new_y += args.dy
                    
                joint['loc'] = [int(new_x), int(new_y)]
                print(f"Moved joint '{args.joint}' from ({curr_x}, {curr_y}) -> ({new_x}, {new_y})")
                break
                
        if not joint_found:
            available_joints = [j['name'] for j in cfg['skeleton']]
            print(f"Error: Joint '{args.joint}' not found. Available: {available_joints}")
            sys.exit(1)
            
        save_yaml(char_cfg_path, cfg)
        
    # Re-generate overlay regardless
    update_joint_overlay(args.char_dir)

if __name__ == '__main__':
    main()
