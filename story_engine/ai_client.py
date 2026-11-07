"""
ai_client.py
============
Sends work to the AI server, which keeps the models and animation engine loaded.
Callers do the work in a new process when the server is not running.
"""

import http.client
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

AI_SERVER_URL = f"http://127.0.0.1:{os.environ.get('AI_SERVER_PORT', '5001')}"
# Requests wait their turn, so this must cover a full class of uploads ahead in the queue.
REQUEST_TIMEOUT_SECONDS = 900

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.join(BASE_DIR, 'Actual repo (EDUVISION)', 'AnimatedDrawings')


def post_to_ai_server(route, body):
    """Returns ("ok", response), ("offline", None) or ("failed", error_text)."""
    request = urllib.request.Request(AI_SERVER_URL + route, data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return "ok", json.load(response)
    except urllib.error.HTTPError as e:
        if e.code == 404:  # an older server that does not have this route
            return "offline", None
        return "failed", e.read().decode(errors="replace")
    except urllib.error.URLError as e:
        if isinstance(e.reason, ConnectionError):
            return "offline", None
        return "failed", str(e.reason)
    except (ConnectionError, http.client.RemoteDisconnected):
        return "offline", None
    except TimeoutError as e:
        return "failed", str(e)


def run_annotations(img_path, out_dir, kps_path=None):
    """Returns (succeeded, error_text)."""
    # The AI server always uses the GPU, so a CPU request runs separately.
    if os.environ.get("USE_GPU", "true").lower() != "false":
        state, response = post_to_ai_server("/annotate", {"img_path": img_path, "out_dir": out_dir, "kps_path": kps_path})
        if state == "ok":
            return True, ""
        if state == "failed":
            return False, response

    script_path = os.path.join(REPO_ROOT, 'examples', 'image_to_annotations.py')
    cmd = [sys.executable, script_path, img_path, out_dir]
    if kps_path:
        cmd.extend(['--keypoints', kps_path])
    result = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
    return result.returncode == 0, result.stderr
