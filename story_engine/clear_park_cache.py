#!/usr/bin/env python3
"""Clear cached composites, scene MP4s, audio files, and final video for park story."""
import os

d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
removed = 0
for f in os.listdir(d):
    if f.startswith("park_scene") or f == "park_story_final.mp4":
        os.remove(os.path.join(d, f))
        print(f"  removed {f}")
        removed += 1
print(f"Cleared {removed} cached files. Character GIFs preserved.")
