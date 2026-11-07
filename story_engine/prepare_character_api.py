import sys
import os
import json
import time
from ai_client import run_annotations
from progress_logger import ProgressLogger

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing image path"}))
        sys.exit(1)
        
    img_path = os.path.abspath(sys.argv[1].strip('"'))
    raw_kps = sys.argv[3].strip('"') if len(sys.argv) > 3 else "none"
    kps_arg = os.path.abspath(raw_kps) if raw_kps != "none" else "none"
    job_id = sys.argv[4].strip('"') if len(sys.argv) > 4 else "unknown_job"
    
    logger = ProgressLogger(job_id, "Fixer")
    logger.log_stage("PREPROCESSING_STARTED", "Starting character preprocessing")
    logger.start_timer("preprocessing")
    
    upload_dir = os.path.dirname(img_path)
    char_id = str(time.time_ns())
    char_dir = os.path.join(upload_dir, f'char_data_{char_id}')
    os.makedirs(char_dir, exist_ok=True)
    
    kps_path = kps_arg if kps_arg != "none" and os.path.exists(kps_arg) else None
    succeeded, error_text = run_annotations(img_path, char_dir, kps_path)

    if not succeeded:
        logger.log_error("Preprocessing engine failed", error_text)
        sys.exit(1)

    logger.end_timer("preprocessing")
    logger.log_stage("PREPROCESSING_COMPLETED", "Character bounding box, mask, and skeleton created")

    # Send charDir back to Node.js for batch_animate spawning
    print(json.dumps({"charDir": char_dir}))

if __name__ == '__main__':
    main()
