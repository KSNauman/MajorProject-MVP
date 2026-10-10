import os
import subprocess
import json
import time

STORY_ENGINE_DIR = r"c:\Major Project - MVP2\Major Project - MVP\story_engine"
CHAR_DIR = r"c:\Major Project - MVP2\Major Project - MVP\characters\rahim"

def run_prepare_character():
    print("Testing prepare_character_api.py...")
    img_path = r"c:\Major Project - MVP2\Major Project - MVP\mask_test.png"
    cmd = ["python", "prepare_character_api.py", img_path, "dummy", "none", "test_job_3"]
    t0 = time.time()
    res = subprocess.run(cmd, cwd=STORY_ENGINE_DIR, capture_output=True, text=True)
    t1 = time.time()
    print(f"prepare_character_api.py returned {res.returncode} in {t1-t0:.2f}s")
    for line in res.stdout.splitlines():
        if 'charDir' in line:
            print("Detected charDir output:", line)

def run_batch_animate():
    print("Testing batch_animate.py (wave motion on rahim)...")
    cmd = ["python", "batch_animate.py", CHAR_DIR, "test_job_1", "--motions", "wave", "--slot", "rahim"]
    t0 = time.time()
    res = subprocess.run(cmd, cwd=STORY_ENGINE_DIR, capture_output=True, text=True)
    t1 = time.time()
    print(f"batch_animate.py returned {res.returncode} in {t1-t0:.2f}s")
    print("STDOUT:", res.stdout)
    if res.returncode != 0:
        print("STDERR:", res.stderr)
    return res.stdout

def run_compose_story():
    print("Testing compose_story.py...")
    # Only supply rahim, other slots should gracefully fallback or skip
    payload = json.dumps({"characters": {"rahim": "default"}, "storyId": "test_story"})
    cmd = ["python", "compose_story.py", payload, "test_job_2"]
    t0 = time.time()
    res = subprocess.run(cmd, cwd=STORY_ENGINE_DIR, capture_output=True, text=True)
    t1 = time.time()
    print(f"compose_story.py returned {res.returncode} in {t1-t0:.2f}s")
    # Print the last few lines to see the generated mp4 path
    print("STDOUT (last 500 chars):", res.stdout[-500:])
    if res.returncode != 0:
        print("STDERR:", res.stderr)

if __name__ == "__main__":
    run_prepare_character()
    print("-" * 40)
    
    out1 = run_batch_animate()
    if "CACHED" not in out1:
        print("-" * 40)
        print("Running again to verify cache hit...")
        out2 = run_batch_animate()
        if "CACHED" in out2:
            print("Cache verified successfully.")
        else:
            print("Cache verification failed (did not say CACHED).")
    else:
        print("Cache already populated and verified (said CACHED).")
        
    print("-" * 40)
    run_compose_story()
