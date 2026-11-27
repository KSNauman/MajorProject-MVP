"""
Reproducible measurements for the EduVision documentation.

Run from the repository root:  python docs/evidence/run_benchmarks.py
Writes docs/evidence/benchmarks.json. Every number in docs/ that cites
"benchmarks.json" comes from this script. Close other apps first: memory
pressure changes timings (see textbook chapter 14).

Sections (each runs in its own Python process so model memory is freed):
  env        hardware and library versions
  model      best.pt size, parameters, warm inference latency (GPU and CPU)
  unlabeled  detector and mask behaviour on every real upload (no ground truth)
  extract    detection + segmentation: cold process vs warm in-process
  animate    per-motion render time, and the 90-frame cap ablation
  compose    full story video build
  knn        handwritten digit model: cross-validated accuracy
"""
import json
import os
import shutil
import statistics as st
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "Actual repo (EDUVISION)" / "AnimatedDrawings"
OUT = Path(__file__).resolve().parent / "benchmarks.json"
FAMILY = ["rahim", "sister", "mother", "father", "grandma", "grandpa"]


def summary(xs):
    xs = list(xs)
    return {"n": len(xs), "mean": round(st.mean(xs), 4), "sd": round(st.stdev(xs), 4) if len(xs) > 1 else 0.0,
            "median": round(st.median(xs), 4), "min": round(min(xs), 4), "max": round(max(xs), 4)}


def section_env():
    import platform
    import psutil
    import torch
    import ultralytics
    import cv2
    import sklearn
    return {
        "os": platform.platform(), "python": platform.python_version(),
        "cpu_threads": os.cpu_count(), "ram_gb": round(psutil.virtual_memory().total / 1e9, 1),
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "torch": torch.__version__, "ultralytics": ultralytics.__version__,
        "opencv": cv2.__version__, "scikit_learn": sklearn.__version__,
    }


def _model():
    sys.path.insert(0, str(ENGINE))
    from examples.image_to_annotations import _load_model
    return _load_model()


def section_model():
    import cv2
    import torch
    t0 = time.perf_counter()
    model = _model()
    load_s = time.perf_counter() - t0
    params = sum(p.numel() for p in model.model.parameters())
    imgs = [cv2.imread(str(ROOT / "characters" / c / "source_image.png")) for c in FAMILY]
    out = {"file_mb": round((ENGINE / "best.pt").stat().st_size / 1e6, 2), "parameters": params,
           "load_seconds": round(load_s, 3)}
    for device in (["cuda"] if torch.cuda.is_available() else []) + ["cpu"]:
        for im in imgs[:2]:
            model(im, verbose=False, device=device)  # warm-up
        times = []
        for _ in range(5):
            for im in imgs:
                t0 = time.perf_counter()
                model(im, verbose=False, device=device)
                times.append((time.perf_counter() - t0) * 1000)
        out[f"inference_ms_{device}"] = summary(times)
    return out


def section_unlabeled():
    """Behaviour on every drawing uploaded during development. There are no
    ground-truth labels, so these are rates and confidences, not accuracy."""
    import cv2
    import numpy as np
    from examples.image_to_annotations import segment
    model = _model()
    files = sorted((ROOT / "eduvision_ui" / "uploads").glob("input_*.png"))
    det, box_conf, kp_conf, kp_visible, n_boxes, area_ratio, failed = 0, [], [], [], [], [], 0
    for f in files:
        img = cv2.imread(str(f))
        if img is None:
            failed += 1
            continue
        r = model(img, verbose=False)[0]
        n = 0 if r.boxes is None else len(r.boxes)
        n_boxes.append(n)
        if n == 0:
            continue
        det += 1
        i = int(r.boxes.conf.argmax())
        box_conf.append(float(r.boxes.conf[i]))
        k = r.keypoints.data[i].cpu().numpy()
        kp_conf.append(float(k[:, 2].mean()))
        kp_visible.append(int((k[:, 2] > 0.5).sum()))
        l, t, rr, b = [int(v) for v in r.boxes.xyxy[i].cpu().numpy()]
        crop = img[max(t, 0):b, max(l, 0):rr]
        if crop.size:
            m = segment(crop)
            area_ratio.append(float((m > 0).mean()))
    return {
        "drawings": len(files), "unreadable": failed,
        "detected_at_least_one": det, "detection_rate": round(det / max(len(files) - failed, 1), 4),
        "boxes_per_image": dict(zip(*[[int(x) for x in v] for v in np.unique(n_boxes, return_counts=True)])),
        "best_box_confidence": summary(box_conf),
        "mean_keypoint_confidence": summary(kp_conf),
        "keypoints_above_0.5_of_17": summary(kp_visible),
        "mask_area_fraction_of_crop": summary(area_ratio),
    }


def section_extract():
    img = ROOT / "characters" / "rahim" / "source_image.png"
    cold = []
    for _ in range(3):
        d = tempfile.mkdtemp()
        t0 = time.perf_counter()
        subprocess.run([sys.executable, "examples/image_to_annotations.py", str(img), d],
                       cwd=ENGINE, capture_output=True, check=True, env=dict(os.environ, PYTHONIOENCODING="utf-8"))
        cold.append(time.perf_counter() - t0)
        shutil.rmtree(d, ignore_errors=True)
    sys.path.insert(0, str(ENGINE))
    os.chdir(ENGINE)
    from examples.image_to_annotations import image_to_annotations
    warm = []
    for i in range(6):
        d = tempfile.mkdtemp()
        t0 = time.perf_counter()
        image_to_annotations(str(img), d)
        if i > 0:  # first call loads the models
            warm.append(time.perf_counter() - t0)
        shutil.rmtree(d, ignore_errors=True)
    return {"cold_process_seconds": summary(cold), "warm_in_process_seconds": summary(warm)}


def section_animate():
    sys.path.insert(0, str(ROOT / "story_engine"))
    os.chdir(ROOT / "story_engine")
    import batch_animate as ba
    import yaml
    from PIL import Image
    real_dump = yaml.dump
    cap = {"end": 90}

    def dump(data, *a, **k):  # lets the ablation change only the frame cap
        if isinstance(data, dict) and "end_frame_idx" in data:
            data = dict(data, end_frame_idx=cap["end"])
        return real_dump(data, *a, **k)
    ba.yaml.dump = dump

    def render(motion, end, slot="rahim"):
        cap["end"] = end
        d = Path(tempfile.mkdtemp()) / slot
        shutil.copytree(ROOT / "characters" / slot, d, ignore=shutil.ignore_patterns("animations"))
        t0 = time.perf_counter()
        r = ba.generate_animation(str(d), motion, ba.STORY_MOTIONS[motion])
        dt = time.perf_counter() - t0
        gif = d / "animations" / f"{motion}.gif"
        frames = Image.open(gif).n_frames if gif.exists() else 0
        size = gif.stat().st_size if gif.exists() else 0
        shutil.rmtree(d.parent, ignore_errors=True)
        assert r["status"] == "ok", r
        return dt, frames, size

    render("idel", 90)  # warm-up: loads the engine once
    per_motion = {}
    for m in ba.STORY_MOTIONS:
        runs = [render(m, 90) for _ in range(3)]
        per_motion[m] = {"seconds": summary([r[0] for r in runs]), "frames": runs[0][1], "gif_kb": round(runs[0][2] / 1e3)}
    ablation = {}
    for m, full in (("wave", 839), ("jump", 250)):
        for end in (90, full):
            runs = [render(m, end) for _ in range(2)]
            ablation[f"{m}_{end}"] = {"seconds": summary([r[0] for r in runs]), "frames": runs[0][1],
                                      "gif_kb": round(runs[0][2] / 1e3)}
    return {"per_motion_90_frames_warm": per_motion, "frame_cap_ablation": ablation}


def section_compose():
    times = []
    for _ in range(3):
        t0 = time.perf_counter()
        p = subprocess.run([sys.executable, "compose_story.py", json.dumps({"characters": {}}), "bench"],
                           cwd=ROOT / "story_engine", capture_output=True, text=True)
        times.append(time.perf_counter() - t0)
        assert p.returncode == 0, p.stderr[-500:]
        for line in p.stdout.splitlines():
            if "finalVideoUrl" in line:
                path = json.loads(line)["finalVideoUrl"].split("path=")[1]
                Path(path).unlink(missing_ok=True)  # keep only the timing, not the file
    return {"story_video_seconds": summary(times), "video": "1280x720, 24 fps, 9 scenes"}


def section_knn():
    import numpy as np
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
    data = json.load(open(ROOT / "platform/activity-center/public/js/digits_knn.json"))
    X, y = np.array(data["X"], dtype=float), np.array(data["y"])
    out = {"samples": int(len(y)), "features": int(X.shape[1]), "per_class": {int(c): int((y == c).sum()) for c in np.unique(y)}}
    cv = StratifiedKFold(n_splits=10, shuffle=True, random_state=42)
    for k in (1, 3, 5, 7):
        pred = cross_val_predict(KNeighborsClassifier(n_neighbors=k, weights="distance"), X, y, cv=cv)
        out[f"k{k}_10fold"] = {"accuracy": round(accuracy_score(y, pred), 4), "macro_f1": round(f1_score(y, pred, average="macro"), 4)}
        if k == 3:
            cm = confusion_matrix(y, pred)
            out["k3_confusion_matrix"] = cm.tolist()
            out["k3_per_digit_recall"] = {int(i): round(cm[i, i] / cm[i].sum(), 4) for i in range(len(cm))}
    return out


SECTIONS = {"env": section_env, "model": section_model, "unlabeled": section_unlabeled, "extract": section_extract,
            "animate": section_animate, "compose": section_compose, "knn": section_knn}

if __name__ == "__main__":
    if len(sys.argv) > 1:  # child process: run one section, print JSON
        name = sys.argv[1]
        if name in ("model", "unlabeled"):
            sys.path.insert(0, str(ENGINE))
        print("@@" + json.dumps(SECTIONS[name]()))
        sys.exit(0)
    results = json.loads(OUT.read_text()) if OUT.exists() else {}
    only = os.environ.get("ONLY")  # e.g. ONLY=extract,compose re-runs just those sections
    for name in (only.split(",") if only else SECTIONS):
        t0 = time.perf_counter()
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        p = subprocess.run([sys.executable, __file__, name], capture_output=True, text=True, cwd=ROOT, env=env, encoding="utf-8")
        line = next((l for l in p.stdout.splitlines() if l.startswith("@@")), None)
        results[name] = json.loads(line[2:]) if line else {"error": p.stderr[-800:]}
        results[name + "_section_seconds"] = round(time.perf_counter() - t0, 1)
        OUT.write_text(json.dumps(results, indent=2))
        print(name, "done" if line else "FAILED", flush=True)
    results["measured_on"] = time.strftime("%Y-%m-%d %H:%M")
    OUT.write_text(json.dumps(results, indent=2))
