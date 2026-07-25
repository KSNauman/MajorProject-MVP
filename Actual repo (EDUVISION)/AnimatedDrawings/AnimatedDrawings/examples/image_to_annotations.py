# Copyright (c) Meta Platforms, Inc. and affiliates.
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

import sys
import os
import requests
import cv2
import json
import numpy as np
from skimage import measure
from scipy import ndimage
from pathlib import Path
import yaml
import logging


def image_to_annotations(img_fn: str, out_dir: str) -> None:
    """
    Given the RGB image located at img_fn, runs detection, segmentation, and pose estimation for drawn character within it.
    Crops the image and saves texture, mask, and character config files necessary for animation. Writes to out_dir.

    Params:
        img_fn: path to RGB image
        out_dir: directory where outputs will be saved
    """

    # create output directory
    outdir = Path(out_dir)
    outdir.mkdir(exist_ok=True)

    # read image
    img = cv2.imread(img_fn)

    # copy the original image into the output_dir
    cv2.imwrite(str(outdir/'image.png'), img)

    # ensure it's rgb
    if len(img.shape) != 3:
        msg = f'image must have 3 channels (rgb). Found {len(img.shape)}'
        logging.critical(msg)
        assert False, msg

    # resize if needed
    if np.max(img.shape) > 1000:
        scale = 1000 / np.max(img.shape)
        img = cv2.resize(img, (round(scale * img.shape[1]), round(scale * img.shape[0])))

    # === START YOLO DETECTION AND POSE ESTIMATION ===
    from ultralytics import YOLO
    
    # Check for custom trained sketch model weights by traversing directories upward to locate 'yolo_test'
    curr_dir = os.path.abspath(os.path.dirname(__file__))
    custom_weights = None
    for _ in range(6):
        possible_path = os.path.join(curr_dir, "yolo_test", "sketch_yolov8_pose.pt")
        if os.path.exists(possible_path):
            custom_weights = possible_path
            break
        parent = os.path.dirname(curr_dir)
        if parent == curr_dir:
            break
        curr_dir = parent
        
    if custom_weights:
        print(f"[*] Loading custom fine-tuned sketch model: {custom_weights}")
        pose_model = YOLO(custom_weights)
    elif os.path.exists("sketch_yolov8_pose.pt"):
        print("[*] Loading custom fine-tuned sketch model: sketch_yolov8_pose.pt")
        pose_model = YOLO("sketch_yolov8_pose.pt")
    else:
        print("[*] Running standard YOLOv8-Pose for character detection and pose estimation...")
        pose_model = YOLO('yolov8n-pose.pt')
    results = pose_model(img)
    
    if len(results) == 0 or len(results[0].boxes) == 0:
        msg = 'YOLOv8-Pose could not detect any humanoid character in the image. Aborting.'
        logging.critical(msg)
        assert False, msg
        
    # Filter out weak detections (e.g. non-humanoid objects)
    conf = results[0].boxes[0].conf[0].item()
    if conf < 0.6:
        msg = f'Detected character confidence ({conf:.2f}) is below threshold (0.60). Aborting.'
        logging.critical(msg)
        assert False, msg
        
    # Take the highest confidence detection
    bbox = results[0].boxes[0].xyxy[0].cpu().numpy()
    l, t, r, b = [round(x) for x in bbox]
    
    # Safety clamp to image dimensions
    l = max(0, l)
    t = max(0, t)
    r = min(img.shape[1], r)
    b = min(img.shape[0], b)
    
    # Dump bounding box coordinates
    with open(str(outdir/'bounding_box.yaml'), 'w') as f:
        yaml.dump({
            'left': int(l),
            'top': int(t),
            'right': int(r),
            'bottom': int(b)
        }, f)
        
    # Crop the image to the character bounding box
    cropped = img[t:b, l:r]
    
    # Get segmentation mask
    mask = segment(cropped)
    
    # Get the keypoints for the first detected person
    kpts_orig = results[0].keypoints.xy[0].cpu().numpy()
    
    # Make keypoints relative to the cropped image
    kpts = kpts_orig - np.array([l, t])
    
    # Build character skeleton rig using COCO keypoint mapping
    skeleton = []
    
    # Calculate auxiliary points
    left_hip = kpts[11]
    right_hip = kpts[12]
    left_shoulder = kpts[5]
    right_shoulder = kpts[6]
    
    root_pt = (left_hip + right_hip) / 2
    torso_pt = (left_shoulder + right_shoulder) / 2
    
    skeleton.append({'loc' : [round(x) for x in root_pt], 'name': 'root'          , 'parent': None})
    skeleton.append({'loc' : [round(x) for x in root_pt], 'name': 'hip'           , 'parent': 'root'})
    skeleton.append({'loc' : [round(x) for x in torso_pt], 'name': 'torso'         , 'parent': 'hip'})
    skeleton.append({'loc' : [round(x) for x in  kpts[0]             ], 'name': 'neck'          , 'parent': 'torso'})
    skeleton.append({'loc' : [round(x) for x in  kpts[6]             ], 'name': 'right_shoulder', 'parent': 'torso'})
    skeleton.append({'loc' : [round(x) for x in  kpts[8]             ], 'name': 'right_elbow'   , 'parent': 'right_shoulder'})
    skeleton.append({'loc' : [round(x) for x in  kpts[10]            ], 'name': 'right_hand'    , 'parent': 'right_elbow'})
    skeleton.append({'loc' : [round(x) for x in  kpts[5]             ], 'name': 'left_shoulder' , 'parent': 'torso'})
    skeleton.append({'loc' : [round(x) for x in  kpts[7]             ], 'name': 'left_elbow'    , 'parent': 'left_shoulder'})
    skeleton.append({'loc' : [round(x) for x in  kpts[9]             ], 'name': 'left_hand'     , 'parent': 'left_elbow'})
    skeleton.append({'loc' : [round(x) for x in  kpts[12]            ], 'name': 'right_hip'     , 'parent': 'root'})
    skeleton.append({'loc' : [round(x) for x in  kpts[14]            ], 'name': 'right_knee'    , 'parent': 'right_hip'})
    skeleton.append({'loc' : [round(x) for x in  kpts[16]            ], 'name': 'right_foot'    , 'parent': 'right_knee'})
    skeleton.append({'loc' : [round(x) for x in  kpts[11]            ], 'name': 'left_hip'      , 'parent': 'root'})
    skeleton.append({'loc' : [round(x) for x in  kpts[13]            ], 'name': 'left_knee'     , 'parent': 'left_hip'})
    skeleton.append({'loc' : [round(x) for x in  kpts[15]            ], 'name': 'left_foot'     , 'parent': 'left_knee'})
    # === END YOLO DETECTION AND POSE ESTIMATION ===

    # create the character config dictionary
    char_cfg = {'skeleton': skeleton, 'height': cropped.shape[0], 'width': cropped.shape[1]}

    # convert texture to RGBA and save
    cropped = cv2.cvtColor(cropped, cv2.COLOR_BGR2BGRA)
    cv2.imwrite(str(outdir/'texture.png'), cropped)

    # save mask
    cv2.imwrite(str(outdir/'mask.png'), mask)

    # dump character config to yaml
    with open(str(outdir/'char_cfg.yaml'), 'w') as f:
        yaml.dump(char_cfg, f)

    # create joint viz overlay for inspection purposes
    joint_overlay = cropped.copy()
    for joint in skeleton:
        x, y = joint['loc']
        name = joint['name']
        cv2.circle(joint_overlay, (int(x), int(y)), 5, (0, 0, 0), 5)
        cv2.putText(joint_overlay, name, (int(x), int(y+15)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, 2)
    cv2.imwrite(str(outdir/'joint_overlay.png'), joint_overlay)


def segment(img: np.ndarray):
    # Try using rembg first, but fall back to OpenCV if not installed/available
    try:
        from rembg import remove
        print("[*] Segmenting using rembg...")
        rgba = remove(img)
        mask = rgba[:, :, 3]
        _, binary_mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        return binary_mask
    except Exception as e:
        print(f"[!] rembg segmentation failed or package is not installed: {e}")
        print("[*] Falling back to standard OpenCV adaptive thresholding segmentation...")
        
        # Original OpenCV-based segmentation implementation:
        # Threshold
        gray = np.min(img, axis=2)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 115, 8)
        thresh = cv2.bitwise_not(thresh)

        # Morphops
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        morph = cv2.morphologyEx(morph, cv2.MORPH_DILATE, kernel, iterations=2)

        # Floodfill
        flood_mask = np.zeros([morph.shape[0]+2, morph.shape[1]+2], np.uint8)
        flood_mask[1:-1, 1:-1] = morph.copy()
        im_floodfill = np.full(morph.shape, 255, np.uint8)

        h, w = morph.shape[:2]
        for x in range(0, w-1, 10):
            cv2.floodFill(im_floodfill, flood_mask, (x, 0), 0)
            cv2.floodFill(im_floodfill, flood_mask, (x, h-1), 0)
        for y in range(0, h-1, 10):
            cv2.floodFill(im_floodfill, flood_mask, (0, y), 0)
            cv2.floodFill(im_floodfill, flood_mask, (w-1, y), 0)

        im_floodfill[0, :] = 0
        im_floodfill[-1, :] = 0
        im_floodfill[:, 0] = 0
        im_floodfill[:, -1] = 0

        # Retain largest contour
        mask2 = cv2.bitwise_not(im_floodfill)
        mask = None
        biggest = 0

        contours = measure.find_contours(mask2, 0.0)
        for c in contours:
            x_arr = np.zeros(mask2.T.shape, np.uint8)
            cv2.fillPoly(x_arr, [np.int32(c)], 1)
            size = len(np.where(x_arr == 1)[0])
            if size > biggest:
                mask = x_arr
                biggest = size

        if mask is None:
            msg = 'Found no contours within image'
            logging.critical(msg)
            assert False, msg

        mask = ndimage.binary_fill_holes(mask).astype(int)
        mask = 255 * mask.astype(np.uint8)

        return mask.T


if __name__ == '__main__':
    log_dir = Path('./logs')
    log_dir.mkdir(exist_ok=True, parents=True)
    logging.basicConfig(filename=f'{log_dir}/log.txt', level=logging.DEBUG)

    img_fn = sys.argv[1]
    out_dir = sys.argv[2]
    image_to_annotations(img_fn, out_dir)
