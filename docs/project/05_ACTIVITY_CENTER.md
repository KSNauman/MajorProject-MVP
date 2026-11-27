# 5. The Activity Center: How Each Game Is Built and How It Uses the Animation Engine

The Activity Center is a small web server (`platform/activity-center/server.js`, port 5000) that serves six learning games and a hub page. Each game is a single HTML file with plain JavaScript in `platform/activity-center/public/activities/`. No game framework is used.

Every game rewards the child with **animations made by EduVision's animation engine**: a drawing comes to life when the child gets something right.

---

## 5.1 Shared Parts Used by Every Game

| File | What it does |
|---|---|
| `public/index.html` | The hub. Loads the game list from `GET /api/activities` and shows a card per game. |
| `public/js/integration.js` | Connects a game to the platform. It reads `token`, `assignmentId`, `mode` and `returnUrl` from the page address. **Fun mode** is on when `mode=fun` or when there is no token. `reportResult()` sends the score to `POST /api/integrations/results` with the launch token, and is skipped in fun mode. It also draws the celebration pop-up. |
| `public/js/engine-audio.js` | Makes every sound with the **Web Audio API**: oscillators with frequency ramps for "pick up", "snap", "success", "soft bounce", "whoosh" and "fanfare". No sound files are downloaded. |
| `public/js/ml-digit-recognizer.js` + `digits_knn.json` | The handwritten-digit recognizer used by Count & Play (§5.4). |
| `server.js` routes | `/api/activities` (game list), `/activity/:id` (redirect, keeps the query string), `/characters/*` (serves the story characters' GIFs), `/api/animate-drawing` (the live animation engine, §5.2.3), `/api/recognize-digit` (server copy of the k-NN, kept for compatibility). |

### How a game is launched and scored

```text
Teacher assigns a game ──► Student taps Start in the portal
        │
        ▼
Platform API checks the assignment belongs to this student and class
        │  POST /api/integrations/launch
        ▼
Signed launch token (JWT, 1 hour) in the game's address
        │
        ▼
Child plays ──► game calls reportResult({score, status, details})
        │  POST /api/integrations/results  (Bearer token)
        ▼
API checks the token's assignmentId matches, then saves an ActivityResult
        │
        ▼
Teacher dashboard and parent dashboard show the score
```

In **fun mode** ("Play for Fun!" on the student dashboard) nothing is saved.

---

## 5.2 Three Ways a Game Gets Its Animations

The games do **not** all run the full AI pipeline. There are three routes, and it matters to say which game uses which.

### Route A: Pre-rendered story characters (full pipeline)

The six "Rahim's Family" characters in `characters/<name>/` were made once by the **full pipeline**:
1. YOLOv8-Pose (`best.pt`) finds the figure and 17 keypoints;
2. rembg plus OpenCV make the mask;
3. the 17 keypoints are mapped to the 16-joint skeleton;
4. ARAP animates the drawing with BVH motion files.

The resulting GIFs (`idel`, `wave`, `jump`, `sleep`, `opening`, `walk_in_circle`) are reused by the games as ready-made rewards. This costs nothing at play time.

### Route B: Pre-rendered solid-colour humanoids (template skeleton)

`story_engine/pregenerate_solid_color_humanoids.py` draws one simple humanoid in six colours with OpenCV. It places a **hand-written 16-joint skeleton** on it, with the neck joint inside the head, and renders `jump` and `walk_in_circle` with the same ARAP engine. The output lives in `public/uploads/solid_humanoids/<colour>/animations/`. The pose model is not needed, because the program drew the figure itself and knows exactly where the joints are.

### Route C: Live animation of the child's own work

`POST /api/animate-drawing` takes a picture as base64, saves it in a new folder under `public/uploads/custom_characters/`, and runs `story_engine/animate_drawing_service.py`. That script:
1. resizes the picture to about 480 px;
2. makes a mask:
   - from the alpha channel if the picture has one;
   - by thresholding light paper (grey < 240) if the border is bright;
   - otherwise with an oval silhouette;
3. builds a **proportional template skeleton**. The neck joint is placed 13% of the way down the mask so the head is held, which fixes the "sinking head" bug;
4. calls the same `generate_animation()` as the story engine, with ARAP and a 90-frame cap.

It returns the GIF's address. A new folder is made for every request, so these results are **not cached**.

> **Honest note:** Route C does **not** use YOLOv8-Pose, rembg or the Fixer. It assumes a standing, front-facing figure, because the games only send that kind of picture (the colouring template or a puzzle photo). An arbitrary photo with a different pose would be rigged wrongly.

---

## 5.3 The Six Games

### 1. Humanoid Color & Animate Studio (`color-filling.html`) — Route C

**Learning goal:** colour recognition and naming; cause and effect ("my colours become a moving character").

**How it is built:**
- An inline SVG humanoid with **12 paintable parts**: hair, head, neck, torso, both arms, both hands, both legs and both shoes.
- A palette of colours. Clicking a part calls `paintPart()`, which sets that part's `fill`.
- "Random colours" and "Reset" buttons.
- Five motion buttons with preview GIFs from Route A: jump, wave, opening ("Star Hero"), walk in circle and sleep.

**How it uses the engine (Route C):**
1. `getColoredDrawingPngDataUrl()` copies the coloured SVG, draws it onto a 360 × 450 canvas and exports a transparent PNG.
2. The PNG and the chosen motion are sent to `/api/animate-drawing`.
3. The returned GIF is shown in the "Your Colored Drawing Came to Life!" panel. "Change Motion" renders the next motion.
4. If the engine fails, `renderCustomColoredAnimatedCharacter()` shows a **CSS fallback**: the same SVG moved by CSS keyframes, so the child still sees something.

**Scoring:** "Complete Activity" reports a fixed score of 100, plus the chosen motion and colours in `details`. There is no right or wrong in colouring.

### 2. Humanoid Color Matcher (`color-matcher.html`) — Route B

**Learning goal:** matching colours to their names (six colours, each with a name and an emoji).

**How it is built:** six SVG humanoids and six named "pedestal" slots, each shuffled. The child drags a humanoid onto a slot, or taps the humanoid and then the slot (for touch screens).

**How it uses the engine:**
- **Correct:** the slot shows that colour's pre-rendered `jump.gif` from Route B. Score +100.
- **Wrong:** the slot briefly plays `walk_in_circle.gif` (a "sad walk"), and the humanoid fades for 1.4 s.

**Scoring:** 100 per correct match, up to 600. It ends after 6 matches.

### 3. Humanoid Spotter Detective (`shape-spotter.html`) — Route A

**Learning goal:** visual discrimination: find the named character among six.

**How it is built:** 8 rounds. Each round picks a random target, shows it with its idle animation, and shows all six family characters in a shuffled grid, each playing `idel.gif`.

**How it uses the engine:**
- **Correct pick:** that card switches to the character's `jump.gif`.
- **Wrong pick:** the card plays `sleep.gif` for 1.4 s, then returns to idle.

**Scoring:** a correct pick earns $100 + 20 \times \text{streak}$, where the streak counts correct picks in a row and resets on a mistake.

### 4. Humanoid Count & Play (`objects-counting.html`) — Route A plus a machine-learning model

**Learning goal:** counting 2 to 8 objects, one-to-one correspondence, number words, and writing digits.

**How it is built:** 5 rounds. Each round scatters $n$ family characters, where $n$ is a random whole number from 2 to 8. They are placed by rejection sampling so no two centres are within 80 px: each placement is tried up to 60 times.
- **Tapping** a character marks it with a badge number, and the browser's speech engine **says the number word aloud** (`speechSynthesis`; no API key, though some browsers use online voices). Tapping again un-counts it.
- The child answers by **writing the digit** on a drawing slate (mouse or touch, 14 px strokes) or by tapping the number keypad.

**Digit recognition (`ml-digit-recognizer.js`), step by step:**
1. Find the bounding box of the ink. Pixels count as ink when alpha > 50 and any colour channel < 220. Fewer than 30 ink pixels means "blank".
2. Copy it into a square with a 15% white margin, centred.
3. Shrink it to **8 × 8** pixels with smoothing.
4. Turn each pixel into "ink amount" from 0 to 16: $f = 16 \times (255 - \text{gray})/255$, with gray $= 0.2989R + 0.5870G + 0.1140B$. This matches the scale of scikit-learn's `load_digits` data.
5. Compare with all **1,797** labelled training digits by Euclidean distance, and take the **3 nearest**.
6. Vote with weights $1/(d + 10^{-5})$. The confidence shown is the winning digit's share of the total vote weight.

The mathematics and measured accuracy are in [02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md) §2.9 and [03_MODEL_METRICS.md](03_MODEL_METRICS.md) §3.4.

**How it uses the engine:** the characters idle while the child counts. On a correct answer they **all switch to `jump.gif`**, and a fanfare plays.

**Scoring:** +20 for a correct answer; −2 for a wrong one (never below 0). At the end, $\text{accuracy} = \text{rounds}/(\text{rounds} + \text{mistakes})$, giving 3 stars at 80% or more, 2 stars at 60% or more, otherwise 1.

### 5. Humanoid Jigsaw Puzzle (`puzzle-builder.html`) — Routes A and C

**Learning goal:** spatial reasoning and part–whole relationships.

**How it is built:**
- The picture is cut into a **2 × 2 or 3 × 3** grid of pieces on a 360 px board, and the pieces are shuffled into a tray.
- The child taps or drags a piece, then the board cell where it belongs.
- Picture sources: one of the six family characters (`characters/<name>/texture.png`), **an uploaded picture**, or **a webcam photo** (`getUserMedia`, captured to a JPEG data URL). The webcam is only switched on when the child presses the camera button.

**How it uses the engine:**
- **Preset character (Route A):** when the last piece snaps in, the board shows that character's animation, for example Rahim's `jump.gif`.
- **Uploaded or webcam picture (Route C):** the picture is sent to `/api/animate-drawing` with the `jump` motion, and the finished puzzle comes alive. If that fails, it falls back to the preset animation.

**Scoring:** +25 per correct piece, −2 per wrong placement. Stars come from accuracy, as in Count & Play.

### 6. Humanoid Train Builder (`number-sequencing.html`) — Route A

**Learning goal:** number order and skip counting.

**How it is built:** a train of 10 cars, with **"Conductor Rahim" waving from the engine** (`rahim/animations/wave.gif`). Four modes:

| Mode | Numbers |
|---|---|
| 1–10 | 1, 2, …, 10 |
| 11–20 | 11, …, 20 |
| Skip by 2 | 2, 4, …, 20 |
| Skip by 5 | 5, 10, …, 50 |

The number tiles are shuffled. The child drags a tile onto a car, or taps a tile to fill the next empty car. A tile only snaps into the car with the same number.

**Scoring:** a correct tile earns $10 + 5 \cdot [\text{streak} > 2]$. A wrong tile costs −2 and resets the streak. Stars: 3 at 90% accuracy or more, 2 at 70% or more.

---

## 5.4 Summary Table

| Game | Learning goal | Animation route | Live engine call? | Score sent |
|---|---|---|---|---|
| Color & Animate | Colours, cause and effect | C | **Yes**, every time | Fixed 100 |
| Color Matcher | Colour names | B | No | 100 per match |
| Spotter Detective | Visual discrimination | A | No | 100 + 20 × streak |
| Count & Play | Counting, writing digits | A + k-NN | No | 20 per round, −2 per mistake |
| Jigsaw Puzzle | Part–whole, spatial | A, or C for photos | Only for photos | 25 per piece, −2 per mistake |
| Train Builder | Number order, skip counting | A | No | 10 (+5 on a streak), −2 per mistake |

Plus **Story Studio**: the hub also links to `http://localhost:3001` (the full sketch-to-story pipeline, documented in [01_SYSTEM_OVERVIEW_AND_METHODS.md](01_SYSTEM_OVERVIEW_AND_METHODS.md)).

---

## 5.5 Known Limitations of the Activity Center

These are stated so nobody over-claims:
1. **Scores are computed in the browser.** The token stops a game sending a score for *another* assignment, but a determined user could edit the score inside their *own* game. For kindergarten homework this risk was accepted. Server-side validation is future work.
2. **Celebration times are fixed values.** The `timeSeconds` shown in the pop-up (35, 40 or 45 s) is not measured play time.
3. **Route C is not cached.** Each "Change Motion" re-renders from scratch, and the folders in `uploads/custom_characters` grow until someone deletes them.
4. **Route C uses a template skeleton.** It suits the colouring template and upright photos, not arbitrary poses.
5. **Digit recognition is trained on adult handwriting** (scikit-learn's digits data). A child's "4" or "7" can look different; the keypad is always there as a backup.
6. **No learning-outcome data yet.** The learning goals above are design intentions; no study has measured them (see [06_ADVANTAGES_LIMITATIONS_FUTURE.md](06_ADVANTAGES_LIMITATIONS_FUTURE.md)).
