# Chapter 14: The Speed Journey - From 12 Minutes to 50 Seconds

This chapter tells the full story of how long EduVision takes to get six uploaded characters ready and build a story video, how that time came down in stages, and what we learned at each stage.

**Date of the latest measurements:** 2026-11-05
**Machine:** Laptop with NVIDIA RTX 2050 (4 GB), 12 CPU threads, 11.7 GB RAM

---

## 1. The Whole Journey at a Glance

The task is always the same: a teacher uploads six drawings for the "Rahim's Family" story, and the system prepares them and makes the video.

| Stage | When | Getting 6 characters ready | Building the story video | Main change |
|---|---|---|---|---|
| **1. First working version** | Sep 2026 | **9-12 minutes** | ~75 s | Rendered the whole motion file |
| **2. Frame cap and caching** | Sep 2026 | **~54 s** (see the note below) | ~75 s | Stopped at 90 frames, background jobs |
| **3. Measured again on the full platform** | Nov 2026 | **~123 s** | **89-124 s** | No change: this is the real starting point for stages 4 and 5 |
| **4. Faster video build and loaded models** | Nov 2026 | Drawing step: 27-39 s down to ~5 s each | **~20 s** | One FFmpeg encode, AI server |
| **5. Animation engine stays loaded** | Nov 2026 | **50.3 s** | **15.8 s** | One queue, faster mesh, 320 px copy |

**Overall:** getting six characters ready went from about 9-12 minutes to about 50 seconds, roughly **11 to 14 times faster**. Building the story video went from about 89-124 seconds to about 16 seconds, roughly **6 to 8 times faster**.

```text
Getting 6 characters ready

Stage 1   |############################################################| 9-12 min
Stage 3   |############                                                | 123 s
Stage 5   |#####                                                       | 50 s

Building the story video

Stage 3   |############################################################| 89-124 s
Stage 5   |########                                                    | 16 s
```

> **Note on the 54 seconds:** Chapter 9 recorded "roughly 54 seconds" for "a full set of character animations". When we timed six real uploads through the full platform in November it took about 123 seconds. The two numbers probably did not measure the same thing, so 54 s should not be compared directly with the November numbers. The stage 3 number, 123 s, is the fair "before" number for this chapter's work.

---

## 2. Stage 1: The Extraordinary Starting Time (9-12 Minutes)

The first story engine exported the **entire** motion file for every animation. The wave motion, for example, has 839 frames, so the engine rendered far more animation than a scene of a few seconds could ever show.

**Why it mattered:** a teacher cannot wait 10 minutes in a live class.

---

## 3. Stage 2: The First Big Reduction

Three changes brought the time down (details in Chapters 9 and 12):

1. **Frame cap:** `batch_animate.py` stops every motion at 90 frames.
2. **Motions per character:** each character renders only the motions it needs in the story.
3. **Caching and background work:** finished GIFs are reused, and rendering no longer blocks the upload request.

Separately, the ARAP solver was optimised by caching its LU factorisation. On a 90-frame wave, one animation went from 6.148 s to 4.403 s (Chapter 12).

**Lesson:** the biggest early win came from not doing unnecessary work.

---

## 4. Stage 3: Measuring Again Showed a Different Picture

We then built the classroom platform (Chapter 13). In November we timed six real uploads again:

| Step | Measured |
|---|---|
| Preparing one drawing | 27-34 s |
| Six characters ready | ~123 s |
| Building the video | 89-124 s |
| Files left behind per story | ~570 MB |

**What had gone wrong:** Chapter 10's persistent AI server had reached 0.37 s per detection request, but the launcher no longer started it, and port 5000 had been given to the Activity Center. Every drawing was back to starting Python and loading the models from nothing.

**Lesson:** a speed-up only counts while it is still running. Re-measure after big changes.

---

## 5. Stage 4: Faster Video and Loaded Models

### 5.1 The Video Build

| Old way | New way |
|---|---|
| Saved every frame as a PNG file | Sends frames directly to FFmpeg |
| Resized the character again for every frame | Resizes each character frame once and reuses it |
| Encoded each scene twice, then joined the scenes | Encodes the whole story once |
| Used shared `scene_1...9` folders | Needs no scene folders, so no shared files or old scenes |

The picture is also better matched to the narration, because frame numbers now come from the story's absolute times. The video length is 23.75 s, matching the narration.

**Result:** 124.2 s down to 21.4 s in a controlled comparison, and 19.6 s through the running engine. The final file is slightly larger (2.05 MB to 2.38 MB) because the video is encoded once instead of twice.

### 5.2 Keeping the Models Loaded

`ai_server.py` came back on **port 5001**. It loads the models once when it starts. A cold start of about 39 s per drawing became about 5 s.

**Result:** preparing a drawing took 5.2-5.8 s through the server.

---

## 6. Stage 5: Finding the Real Upload Bottleneck

The story video was now fast, but uploads still felt slow. We first checked whether `best.pt` was the problem.

### 6.1 The Model Was Not the Problem

`best.pt` takes only about 0.1 s per drawing. It found one figure in all 13 test drawings, and the skeletons looked right on the family characters and most examples.

### 6.2 Where One Animation Job Really Spent Its Time

| Part | Approximate time |
|---|---|
| Starting Python and loading libraries | 4-5 s |
| Building the mesh | 1.9 s |
| Setting up ARAP | 1.9 s |
| Linking drawing pixels to joints | 1 s |
| **Actually rendering and saving the animation** | **under 1 s** |

**The surprising result:** almost all the time was setup, not animation.

In addition, all six uploads animated at the same time, because each upload was its own job. They competed for the CPU and for memory that was already 97% full.

### 6.3 The Experiments

We tried each idea on five real animation jobs before changing anything:

| Option | Seconds per motion | Decision |
|---|---|---|
| New process for every job | ~10 | Old way |
| Keep the engine loaded | 5.8 | **Kept** |
| Plus batched mesh checks | 4.0 | **Kept**: the mesh is identical |
| Plus a 320 px copy for animation | 2.3 | **Kept**: looks clean, pose changes slightly |
| Rougher character outline | 1.7 | **Rejected**: visible tears in legs and shoulder |
| Fewer inner mesh points | No real gain | **Rejected** |

### 6.4 What Was Built

1. **One loaded engine:** `ai_server.py` also handles animation. It works on one request at a time, which also gives all uploads a single queue.
2. **Batched mesh checks:** `_generate_mesh` in `animated_drawing.py` now checks all points in one call using Shapely 2. On all six characters the mesh was **exactly identical**, and building it went from 1.2-2.7 s to about 0.1 s.
3. **320 px animation copy:** characters are only about 275 px tall in the GIF, so animation runs from a smaller temporary copy. The original files stay full size for the Fixer.
4. **Fallback:** if the AI server is off, everything still works the old, slower way.

### 6.5 Final Result

Six simultaneous uploads through the real engine:

| Character | Ready after |
|---|---|
| Sister | 14.6 s |
| Father | 18.7 s |
| Grandpa | 23.1 s |
| Grandma | 27.1 s |
| Rahim (3 motions) | 44.5 s |
| Mother | 50.3 s |

**All six were ready in 50.3 s, and the story video then took 15.8 s.**

Testing with six uploads at once also exposed two bugs, now fixed:
- Two uploads in the same millisecond received the same temporary file name and corrupted each other. This bug was already in the system.
- A story build that crashed could leave a `.part` file behind. This one came from the new video code.

---

## 7. Limits and Costs

These results should be reported honestly:

- **Memory:** the AI server now holds about 3 GB of RAM. This levelled off during a test of 24 animations in a row, but it matters on a laptop that is already nearly full.
- **Server start:** the server needs about 20-40 s at launch. Uploads made before it is ready use the slower way.
- **One crash point:** every upload now shares one server. If it stops, uploads use the slower way until it is restarted.
- **Not the same picture:** the 320 px copy changes how a character bends slightly. In one test frame Rahim's foot had a small flaw.
- **Timing varies:** the same rembg step took 1.3 s in some runs and 5.5 s in others with no code change. Full memory is a likely cause but this was not proved, so treat small differences as noise.
- **rembg runs on the CPU:** `onnxruntime` and `onnxruntime-gpu` are both installed, and only the CPU is available to it.
- **The stages were not measured under identical conditions:** stages 1 and 2 come from earlier chapters, so the long-range comparison is approximate. Stages 3 to 5 were measured on this laptop in November.

### Still Open
- A failed animation can still show "Ready".
- The wave motion uses only its first 90 of 839 frames, so it plays slowly and may not complete. Sampling frames evenly would fix this.
- A character appears smaller in the jump scene because size is measured from the whole jump.

---

## 8. What We Learned

1. **Measure first.** We suspected the model, but it took 0.1 s. The real cost was repeated setup.
2. **Look for repeated work.** Reloading the same libraries for every motion cost far more than rendering the animation.
3. **Try ideas before keeping them.** Two of the options looked good but were rejected after testing.
4. **Prove nothing broke.** The mesh change was accepted because its output was compared exactly with the old code.
5. **Test the way people use it.** Six uploads at once found a bug that one upload at a time never would.
6. **Keep measuring.** The earlier AI server gain was silently lost when the launcher changed.

---

## 9. How to Reproduce the Numbers

1. Run `stop-eduvision.bat`, then `start-eduvision.bat`.
2. Wait until the `EduVision-AIServer` window says the server is ready.
3. Close other apps, because memory use affects the timings.
4. Upload all six characters on the Story page and time until all show **Ready**.
5. Click **Make Video** and time until it plays.

Note that characters already rendered are reused from the cache, so use new uploads each time.
