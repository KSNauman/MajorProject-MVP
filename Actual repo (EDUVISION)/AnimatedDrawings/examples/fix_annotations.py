# Copyright (c) Meta Platforms, Inc. and affiliates.
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

import argparse
import base64
from flask import Flask, render_template, request
import json
import os
import sys
import yaml
import webbrowser
from threading import Timer

# Ensure fixer_app directory is resolved correctly from the script location
base_dir = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(base_dir, "fixer_app"))

# Add base_dir to sys.path to easily import annotations_to_animation
if base_dir not in sys.path:
    sys.path.append(base_dir)
from annotations_to_animation import annotations_to_animation

global cfg_path
global char_folder


def load_cfg(path):
    with open(path, "r") as f:
        cfg_text = f.read()
        cfg_yaml = yaml.load(cfg_text, Loader=yaml.Loader)
    return cfg_yaml


def write_cfg(path, cfg):
    with open(path, "w") as f:
        yaml.dump(cfg, f)


@app.route("/")
def index():
    global cfg_path
    global char_folder
    cfg = load_cfg(cfg_path)

    base64_img = {"data": ""}
    with open(os.path.join(char_folder, "texture.png"), "rb") as image_file:
        base64_img['data'] = str(base64.b64encode(image_file.read()), "utf-8")

    return render_template('dist/index.html', cfg=cfg, image=base64_img)


@app.route("/annotations/submit", methods=["POST"])
def post_cfg():
    output, message = process(request)
    
    status_title = "Success!"
    motion_cfg = None
    retarget_cfg = None
    output_video = None
    
    if output:
        print("Joint annotations updated successfully.")
        
        # Now let's automatically generate/update the animation!
        # First, try to read the last used motion/retarget configs from mvc_cfg.yaml
        mvc_path = os.path.join(char_folder, "mvc_cfg.yaml")
        if os.path.exists(mvc_path):
            try:
                with open(mvc_path, "r") as f:
                    mvc_data = yaml.safe_load(f)
                char_info = mvc_data['scene']['ANIMATED_CHARACTERS'][0]
                motion_cfg = char_info['motion_cfg']
                retarget_cfg = char_info['retarget_cfg']
            except Exception as e:
                print(f"Could not parse existing mvc_cfg.yaml: {e}")
                
        # If not found, use default paths
        if not motion_cfg:
            for possible_path in [
                os.path.join(base_dir, "config/motion/wave_hello.yaml"),
                os.path.abspath("./config/motion/wave_hello.yaml"),
                os.path.abspath("./examples/config/motion/wave_hello.yaml")
            ]:
                if os.path.exists(possible_path):
                    motion_cfg = possible_path
                    break
            if not motion_cfg:
                motion_cfg = os.path.join(base_dir, "config/motion/wave_hello.yaml")
                
        if not retarget_cfg:
            for possible_path in [
                os.path.join(base_dir, "config/retarget/fair1_ppf.yaml"),
                os.path.abspath("./config/retarget/fair1_ppf.yaml"),
                os.path.abspath("./examples/config/retarget/fair1_ppf.yaml")
            ]:
                if os.path.exists(possible_path):
                    retarget_cfg = possible_path
                    break
            if not retarget_cfg:
                retarget_cfg = os.path.join(base_dir, "config/retarget/fair1_ppf.yaml")
                
        print(f"Automatically starting animation render...")
        print(f"Motion config: {motion_cfg}")
        print(f"Retarget config: {retarget_cfg}")
        
        try:
            annotations_to_animation(char_folder, motion_cfg, retarget_cfg)
            output_video = os.path.join(char_folder, "video.gif")
            message += f" and the animation has been automatically re-generated!"
        except Exception as e:
            status_title = "Animation Error"
            message += f", but animation generation failed: {e}"
    else:
        status_title = "Error"
        
    return render_template(
        'submit.html',
        status_title=status_title,
        message=message,
        motion_cfg=motion_cfg,
        retarget_cfg=retarget_cfg,
        output_video=output_video
    )


def process(request):
    try:
        formdata = request.form.get('data')
    except Exception as e:
        return None, f"Error parsing data from request. No JSON data was found: {e}"

    try:
        jsondata = json.loads(formdata)
    except Exception as e:
        return None, f"Error parsing submission data into JSON. Invalid format?: {e}"

    # convert joint locations from floats to ints
    for joint in jsondata['skeleton']:
        joint['loc'][0] = round(joint['loc'][0])
        joint['loc'][1] = round(joint['loc'][1])

    try:
        new_cfg = yaml.dump(jsondata)
    except Exception as e:
        return None, f"Error converting submission to YAML data. Invalid format?: {e}"

    try:
        write_cfg(os.path.join(cfg_path), jsondata)
    except Exception as e:
        return None, f"Error saving down file to `{cfg_path}`: {e}"

    return new_cfg, f"Successfully saved config to `{cfg_path}`"


def open_browser(port):
    webbrowser.open_new(f"http://127.0.0.1:{port}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('char_folder', type=str, help="the location of the character bundle")
    parser.add_argument('--port', type=int, default=5050, help="the port the tool launches on")
    args = parser.parse_args()

    char_folder = args.char_folder
    cfg_path = os.path.join(char_folder, "char_cfg.yaml")

    if not os.path.isfile(cfg_path):
        print(f"[Error] File not found. Expected config file at: {cfg_path}")
        sys.exit(1)
        
    # Start a timer to open the browser 1.5 seconds after Flask starts
    Timer(1.5, open_browser, [args.port]).start()
    
    print(f"Launching joint annotation server at http://127.0.0.1:{args.port}/ ...")
    app.run(port=args.port, debug=False)
