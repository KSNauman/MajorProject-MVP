import os
import sys
import json
import yaml
import subprocess
import shutil

# Paths
REPO_ROOT = r"c:\Major Project - MVP2\Major Project - MVP\Actual repo (EDUVISION)\AnimatedDrawings"
STORY_ENGINE = r"c:\Major Project - MVP2\Major Project - MVP\story_engine"
UPLOADS_DIR = r"c:\Major Project - MVP2\Major Project - MVP\eduvision_ui\uploads"
ASSETS_DIR = os.path.join(REPO_ROOT, "assets", "Rahim's Story")
OUTPUT_DIR = os.path.join(STORY_ENGINE, "output")

# Add AnimatedDrawings to path
sys.path.append(REPO_ROOT)
import animated_drawings.render

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 9-Scene Configuration
SCENES = [
    {
        "id": 1,
        "start": 0.13, "end": 1.23,
        "bg": "bg_bedroom.png",
        "chars": {
            "rahim": {"bvh": "idel.bvh", "pos": [0, -0.2]}
        }
    },
    {
        "id": 2,
        "start": 2.58, "end": 3.66,
        "bg": "bg_hallway.png",
        "chars": {
            "rahim": {"bvh": "wave.bvh", "pos": [0, -0.2]}
        }
    },
    {
        "id": 3,
        "start": 5.16, "end": 6.25,
        "bg": "bg_bedroom.png",
        "chars": {
            "sister": {"bvh": "sleep.bvh", "pos": [0.5, -0.3]}
        }
    },
    {
        "id": 4,
        "start": 7.65, "end": 8.65,
        "bg": "bg_hallway.png",
        "chars": {
            "rahim": {"bvh": "wave.bvh", "pos": [0, -0.2]}
        }
    },
    {
        "id": 5,
        "start": 10.15, "end": 11.93,
        "bg": "bg_kitchen.png",
        "chars": {
            "mother": {"bvh": "opening.bvh", "pos": [-0.3, -0.2]},
            "grandma": {"bvh": "walk in circle.bvh", "pos": [0.4, -0.1]}
        }
    },
    {
        "id": 6,
        "start": 13.57, "end": 14.59,
        "bg": "bg_hallway.png",
        "chars": {
            "rahim": {"bvh": "wave.bvh", "pos": [0, -0.2]}
        }
    },
    {
        "id": 7,
        "start": 16.05, "end": 17.93,
        "bg": "bg_study_garden.png",
        "chars": {
            "father": {"bvh": "opening.bvh", "pos": [-0.3, -0.2]},
            "grandpa": {"bvh": "walk in circle.bvh", "pos": [0.4, -0.1]}
        }
    },
    {
        "id": 8,
        "start": 19.62, "end": 20.65,
        "bg": "bg_hallway.png",
        "chars": {
            "rahim": {"bvh": "wave.bvh", "pos": [0, -0.2]}
        }
    },
    {
        "id": 9,
        "start": 22.41, "end": 23.88,
        "bg": "bg_bedroom.png",
        "chars": {
            "rahim": {"bvh": "jump.bvh", "pos": [0, -0.2]}
        }
    }
]

def get_char_dir(slot, char_id):
    if char_id == "default":
        with open(os.path.join(ASSETS_DIR, f"{slot}_default_dir.txt"), "r") as f:
            return os.path.join(UPLOADS_DIR, f.read().strip())
    else:
        return os.path.join(UPLOADS_DIR, char_id)

def create_retarget(char_dir, x, y, scene_id, slot):
    base_retarget = os.path.join(REPO_ROOT, "examples", "config", "retarget", "fair1_ppf.yaml")
    with open(base_retarget, "r") as f:
        cfg = yaml.safe_load(f)
    
    cfg['char_starting_location'] = [float(x), float(y), 0.0]
    
    out_path = os.path.join(char_dir, f"retarget_s{scene_id}_{slot}.yaml")
    with open(out_path, "w") as f:
        yaml.dump(cfg, f)
    return out_path

def main():
    if len(sys.argv) < 2:
        print("Missing payload")
        sys.exit(1)
        
    payload = json.loads(sys.argv[1])
    characters = payload.get("characters", {})
    
    print(f"Starting Generation for Story: {payload.get('storyId')}")
    
    scene_videos = []
    
    for scene in SCENES:
        sid = scene["id"]
        print(f"--- Processing Scene {sid} ---")
        
        scene_dir = os.path.join(OUTPUT_DIR, f"scene_{sid}")
        os.makedirs(scene_dir, exist_ok=True)
        
        anim_chars = []
        for slot, char_info in scene["chars"].items():
            char_id = characters.get(slot, "default")
            char_dir = get_char_dir(slot, char_id)
            
            bvh_path = os.path.join(ASSETS_DIR, char_info["bvh"])
            pos = char_info["pos"]
            
            # Motion Config
            motion_yaml = os.path.join(char_dir, f"motion_s{sid}_{slot}.yaml")
            with open(motion_yaml, "w") as f:
                yaml.dump({
                    'filepath': bvh_path.replace('\\', '/'),
                    'scale': 0.01,
                    'up': '+y',
                    'forward': '+z'
                }, f)
                
            # Retarget Config
            retarget_yaml = create_retarget(char_dir, pos[0], pos[1], sid, slot)
            
            anim_chars.append({
                'character_cfg': os.path.join(char_dir, 'char_cfg.yaml').replace('\\', '/'),
                'motion_cfg': motion_yaml.replace('\\', '/'),
                'retarget_cfg': retarget_yaml.replace('\\', '/')
            })
            
        vid_path = os.path.join(scene_dir, 'video.mp4')
            
        mvc_cfg = {
            'scene': {
                'ANIMATED_CHARACTERS': anim_chars,
                'ADD_AD_RETARGET_BVH': False,
                'ADD_FLOOR': False
            },
            'view': {
                'BACKGROUND_IMAGE': os.path.join(ASSETS_DIR, scene["bg"]).replace('\\', '/'),
                'BACKGROUND_COLOR': [255, 255, 255, 255],
                'WINDOW_DIMENSIONS': [1920, 1080]
            },
            'controller': {
                'MODE': 'video_render',
                'OUTPUT_VIDEO_PATH': vid_path.replace('\\', '/'),
                'OUTPUT_VIDEO_CODEC': 'mp4v'
            }
        }
        
        mvc_path = os.path.join(scene_dir, "mvc_cfg.yaml")
        with open(mvc_path, "w") as f:
            yaml.dump(mvc_cfg, f)
            
        print(f"Rendering Scene {sid} video...")
        animated_drawings.render.start(mvc_path)
        
        # Audio Extraction via ffmpeg
        audio_clip = os.path.join(scene_dir, "audio.mp3")
        full_audio = os.path.join(ASSETS_DIR, "rahim_story_audio.mp3")
        duration = scene["end"] - scene["start"]
        print(f"Extracting Audio for Scene {sid} ({scene['start']}s to {scene['end']}s)")
        
        # ffmpeg -y -i input.mp3 -ss start -t duration output.mp3
        subprocess.run(["ffmpeg", "-y", "-i", full_audio, "-ss", str(scene["start"]), "-t", str(duration), audio_clip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Mux audio and video (scale video to match audio length roughly or just mux)
        # Note: video might be longer or shorter than audio. Let's just crop video to audio length or vice versa.
        # -shortest finishes encoding when the shortest input stream ends
        muxed_vid = os.path.join(scene_dir, "scene_muxed.mp4")
        print(f"Muxing Audio/Video for Scene {sid}")
        # Add -pix_fmt yuv420p for compatibility
        subprocess.run(["ffmpeg", "-y", "-i", vid_path, "-i", audio_clip, "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", "-shortest", muxed_vid], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        scene_videos.append(muxed_vid)
        
    print("--- Concatenating All Scenes ---")
    list_file = os.path.join(OUTPUT_DIR, "concat_list.txt")
    with open(list_file, "w") as f:
        for vid in scene_videos:
            # Need forward slashes and single quotes for ffmpeg concat
            f.write(f"file '{vid.replace('\\', '/')}'\\n")
            
    final_output = os.path.join(OUTPUT_DIR, "rahims_story_final.mp4")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", final_output], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print(f"Story generated successfully: {final_output}")
    
if __name__ == "__main__":
    main()
