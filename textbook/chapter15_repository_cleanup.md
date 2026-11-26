# Chapter 15: Repository Cleanup

The project grew quickly, and many scratch scripts, prototypes and old pipeline versions stayed in the repository after newer code replaced them. This chapter records what was removed, why, and how to get any of it back.

Every removed file was checked first: nothing in the running system (the API, portal, Activity Center, Story Studio or story engine) imports, launches or links to it.

**To restore any file**, check out the commit just before the one that removed it. For example:

```bash
git checkout cd45b37 -- story_engine/tell_story_video.py
git checkout cd45b37~1 -- platform/activities_python
```

Section 1 was removed in commit `cd45b37`, `platform/api/new_migration.sql` in `3011c72`, and everything else on the `chore/repo-cleanup` branch.

---

## 1. Old Python game prototypes

| Removed | What it was | Replaced by |
|---|---|---|
| `platform/activities_python/` (11 games) | The original Pygame/OpenCV versions of the learning games: Alphabet Sequencing, Animal Sorting, Color Filling, Color Sorting, Draw Missing Number, Fruits Matching, Number Sequencing, Objects Counting, Puzzle, Shape Spotter, Vegetables Matching | The six web games in `platform/activity-center/public/activities/` |

## 2. Old story engine versions

| Removed | What it was | Replaced by |
|---|---|---|
| `story_engine/tell_story.py` | First story generator | `compose_story.py` |
| `story_engine/tell_story_video.py` | Story video with MoviePy and gTTS voice-over (the only file that used them) | `compose_story.py`, which uses Pillow, FFmpeg and a recorded narration file |
| `story_engine/generate_scene_story.py` | Earlier scene-by-scene generator | `compose_story.py` |
| `story_engine/generate_animation_api.py` | Earlier single-animation endpoint script | `batch_animate.py` |
| `story_engine/extract_keypoints_api.py` | Earlier keypoint extraction script | `robust_extract_api.py` |
| `story_engine/rembg_api.py` | Stand-alone background removal script | The hybrid rembg + OpenCV mask inside `image_to_annotations.py` |
| `story_engine/test_engine_baseline.py` | One-off timing test for the old pipeline | The automated tests in `platform/api/tests/` |

## 3. Scratch and debug files

| Removed | What it was |
|---|---|
| `server_original.txt` | A saved copy of an old version of the engine server |
| `seed-test.js`, `test-generate.js`, `test-launch.js`, `test-path.js` | Quick manual test scripts from development |
| `transcript_search.txt` | Notes from a debugging session |
| `query` | Accidental output of a `sc query` command |
| `todo.md` | Old to-do list, already finished |
| `mask_test.png`, `mask_test2.png` | Test images used only by `test_engine_baseline.py` |
| `arap_benchmark.py`, `arap_benchmark_dense.py` | One-off ARAP speed benchmarks (results are in Chapter 14) |
| `eduvision_ui/public/test_script.js`, `platform/student-story-studio/public/test_script.js` | Empty files |
| `platform/api/check-db.js` | Unused database connection check |
| `platform/api/new_migration.sql` | Empty file |
| `textbook/test_images/` (14 images) | Sample drawings not referenced by any chapter |

## 4. Kept on purpose

These look unused but are not:

| File | Why it stays |
|---|---|
| `story_engine/preprocess_defaults.py` | Rebuilds the six default story characters |
| `story_engine/pregenerate_solid_color_humanoids.py` | Rebuilds the solid-colour game characters |
| `story_engine/ai_server.py`, `story_engine/ai_client.py` | Called by the batch and preparation scripts |
| `story_engine/pkg_resources.py` | Imported by the AnimatedDrawings engine |
| `tail-logs.ps1` | Log viewer described in `docs/TROUBLESHOOTING.md` |
| `IDEA.md`, `project_handover.md`, `3d_to_2d_retargeting_physics.md` | Team notes and design history |

## 5. The model file

The custom YOLOv8-Pose model, `Actual repo (EDUVISION)/AnimatedDrawings/best.pt` (about 20 MB), is now committed and pushed, so it no longer exists only on one laptop.

- `.gitignore` explicitly allows `*.pt`, so a retrained model is never ignored by accident.
- `.gitattributes` marks `*.pt` as binary, so git never tries to compare or merge it as text.
- The file is under GitHub's 100 MB limit, so Git LFS is not needed.
- `yolov8n.pt` (the public base model) and rembg's `u2net*.onnx` files are not stored, because they download automatically.

The training notebook for `best.pt` is not in the repository yet. Adding it would let anyone reproduce the model.

---

*Last updated: November 26, 2026*
