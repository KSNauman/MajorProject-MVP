import sys
import json
import time
import logging

class ProgressLogger:
    def __init__(self, job_id, component):
        self.job_id = job_id
        self.component = component
        self.start_times = {}

    def log_stage(self, stage, message, character=None, scene=None):
        evt = {
            "progress_event": True,
            "timestamp": time.time(),
            "job": self.job_id,
            "component": self.component,
            "stage": stage,
            "message": message
        }
        if character: evt["character"] = character
        if scene: evt["scene"] = scene
        
        print(json.dumps(evt))
        sys.stdout.flush()

    def start_timer(self, operation):
        self.start_times[operation] = time.time()
        self.log_info(f"START: {operation}")

    def end_timer(self, operation):
        if operation in self.start_times:
            duration = time.time() - self.start_times[operation]
            self.log_info(f"END: {operation} (Duration: {duration:.2f}s)")
            return duration
        return None

    def log_info(self, message):
        print(f"[INFO][{self.job_id}][{self.component}] {message}", file=sys.stderr)
        sys.stderr.flush()
        
    def log_error(self, message, error=None):
        err_msg = f"{message} - {str(error)}" if error else message
        print(f"[ERROR][{self.job_id}][{self.component}] {err_msg}", file=sys.stderr)
        sys.stderr.flush()
