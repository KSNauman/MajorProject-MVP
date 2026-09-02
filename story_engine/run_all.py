import os
import sys

# Clear cache
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
removed = 0
for f in os.listdir(d):
    if f.startswith("park_scene") or f == "park_story_final.mp4":
        os.remove(os.path.join(d, f))
        print(f"  removed {f}")
        removed += 1
print(f"Cleared {removed} cached files. Character GIFs preserved.")

# Run story
import park_story
park_story.main()
