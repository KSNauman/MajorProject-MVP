# 8. Security, Children's Privacy and Licensing

Both reviewers said that a system holding children's drawings and names must treat security, privacy and licences as core topics. This document covers what is protected today, the threats, what is still open, and the licence of every major component.

---

## 8.1 What Data the System Holds

| Data | Where | Personal? |
|---|---|---|
| Child's display name, avatar, username | PostgreSQL `User` | **Yes** |
| Parent's name, username, password hash | PostgreSQL `User`, `ParentChild` | Yes |
| Class membership, assignments, scores | PostgreSQL | Yes (about a child) |
| Child's drawings | `eduvision_ui/uploads/`, `platform/activity-center/public/uploads/custom_characters/` | **Yes**: a child's creative work, linked to a child |
| Story videos | `story_engine/output/`, linked by `StudentStory` | Yes |
| Webcam photo (Jigsaw, only if the child presses the camera button) | Sent to `/api/animate-drawing`, stored under `custom_characters/` | **Yes**, possibly a face |

**Drawings, photos, videos and scores never leave the school computer.** There are no cloud AI APIs, no analytics and no advertising ([04](04_WHY_NO_GENERATIVE_AI_APIS.md)).

**But three kinds of request do go to outside websites** (found in this audit):

| Outside site | What is sent | Risk | Fix |
|---|---|---|---|
| `api.dicebear.com` (avatar pictures) | The **child's display name**, inside the avatar address (`?seed=<name>`), every time an avatar is shown. Set in `admin.js` (bulk enrolment), `portal.js` (parent adds a child) and `seed-demo.js` | **A child's name reaches a third party** | Use a random ID as the seed, or draw avatars locally |
| `fonts.googleapis.com` | Nothing personal; the browser's IP address and the page | Low | Bundle the fonts locally |
| `cdnjs.cloudflare.com` (Fabric.js, Font Awesome) | Nothing personal; the browser's IP address | Low, but **the Fixer does not work offline** | Bundle the libraries locally |

Until these are bundled locally, the pages need internet access even though all AI work is local.

---

## 8.2 Controls in Place

| Control | How | Checked by |
|---|---|---|
| Password hashing | bcrypt, cost 10 (1,024 rounds), per-user salt | Code review ([02 §2.14.2](02_MATHEMATICAL_FOUNDATIONS_AND_PROOFS.md)) |
| Signed sessions | JWT HS256, 1-day login tokens; **no default secret**, so the server refuses to work without `JWT_SECRET` | `api.test.js`, `logging.test.js` |
| Role checks | Teacher-only, parent-only and admin-only middleware on every protected route | `api.test.js` |
| Class-scoped student view | The token carries the class chosen at login; assignments are filtered to it | `data_integrity.test.js` |
| Launch authorisation | Launch only for an assignment of **this student, this class, this app** (fixed November 2026; reviewer issue 4.9 / 3.4) | `data_integrity.test.js` |
| Result forgery check | The result's `assignmentId` must equal the one signed into the 1-hour app token | `integration.test.js` |
| Teacher ownership | A teacher can only assign to, and delete from, classes they teach | `data_integrity.test.js` |
| Parent–child privacy | A parent sees only linked children; video streaming checks the link, including for byte-range requests | `story_video_security.test.js` (15 cases) |
| Path traversal | Video paths must stay inside allowed folders (`../` is blocked) | `story_video_security.test.js` |
| Tokens hidden in logs | `?token=` is redacted from logged URLs | `logging.test.js` |
| All-or-nothing enrolment | Bulk enrolment runs in one database transaction | `data_integrity.test.js` |
| Deletion | Deleting a student removes their results, stories, memberships, links and personal assignments in one transaction | `data_integrity.test.js` |
| Separate test database | Tests run on `eduvision_test`, never on real data | `tests/useTestDatabase.js` |

**53 of 53 tests pass** (27 November 2026).

---

## 8.3 Threat Model

**Assumed setting:** one school computer on a school network; children use it under a teacher's supervision; the teacher controls the device.

| Threat | Likelihood in that setting | Current state | Mitigation |
|---|---|---|---|
| Child logs in as a classmate (avatar login) | Medium | **Possible by design** | Supervision; future: optional picture password or class code |
| Student submits a fake score from the browser console | Low (kindergarten) | **Possible** for their own assignment | Future: server-side scoring |
| Someone on the school network opens port 3000 and downloads drawings | Medium | **Open: no login on the Story Engine** | **Must fix** (§6.3 item 1): put a login in front of it, or bind it to localhost and serve through the API |
| Database leak | Low | Passwords hashed; names and scores readable | Encrypt the disk; restrict the database to localhost |
| Stolen `JWT_SECRET` | Low | Anyone could forge tokens | Keep `.env` out of git (it is ignored); rotate if leaked |
| Default password `password123` | High if not changed | **Open** | Force a change at first login |
| Webcam misuse | Low | Camera turns on only when the child presses the button; the browser asks permission | Keep it that way; add a visible "camera on" banner |

---

## 8.4 Children's Data and the Law (India)

The **Digital Personal Data Protection Act, 2023** applies to schools and service providers handling personal data in India. For children (under 18) it requires, in summary:
- **verifiable consent from a parent or guardian** before processing (Section 9);
- **no tracking, behavioural monitoring or targeted advertising** directed at children.

> We could not download the official text on 27 November 2026 (the government servers returned HTTP 403). Verify every point against the gazette text before relying on it.

**How EduVision lines up:**

| Requirement | Status |
|---|---|
| Parental consent | **Not built yet.** Add a consent step when a parent account is created or linked, and keep a record of it |
| Purpose limitation | Data is used only for the child's own stories, games and progress reports |
| No tracking or advertising | Met: there are no analytics or ads (outside font, library and avatar requests are listed in §8.1) |
| Data stays local | Drawings, videos and scores: met. Children's names: **not yet**, because of the DiceBear avatar addresses (§8.1) |
| Deletion on request | Met technically (admin delete), but there is no parent-facing request process yet |
| Retention period | **Not defined.** Uploads and videos are kept forever; add an end-of-year cleanup |

For wider use outside India, COPPA (USA) and GDPR (EU) have similar consent rules for children.

---

## 8.5 Licences of the Components

| Component | Licence | What it means for EduVision |
|---|---|---|
| **Ultralytics YOLOv8** (library and our `best.pt`, which is derived from it) | **AGPL-3.0** (stated inside `best.pt`) | If EduVision is offered **to others over a network**, AGPL requires making the complete source code (including our changes) available to those users. For a college project and an open repository this is satisfied. **A commercial closed-source product would need an Ultralytics enterprise licence.** |
| Meta AnimatedDrawings (code, original weights, Amateur Drawings dataset) | MIT | Free to use and modify; keep the copyright notice (kept in `Actual repo (EDUVISION)/AnimatedDrawings/LICENSE`) |
| rembg | MIT | Free to use |
| U²-Net model weights (downloaded by rembg) | Apache-2.0 (per the U²-Net project; verify) | Free to use with notice |
| PyTorch, scikit-learn, Flask, Shapely | BSD-3-Clause | Free to use |
| OpenCV | Apache-2.0 | Free to use |
| Pillow | MIT-CMU | Free to use |
| imageio-ffmpeg (Python wrapper) | BSD-2-Clause; **the FFmpeg binary it downloads may be a GPL build** | Fine for an open project; check before closed distribution |
| Express, React, jsonwebtoken, Fabric.js | MIT | Free to use |
| Prisma | Apache-2.0 | Free to use |
| bcryptjs | BSD-3-Clause | Free to use |
| Mixamo motion files (idle, jump, sleep, opening, walk) | Adobe Mixamo terms (royalty-free in projects; check redistribution rules) | **Verify** before publishing the BVH files publicly |
| scikit-learn digits data (`digits_knn.json`) | UCI dataset, distributed with scikit-learn | Free for research and education; cite Alpaydin & Kaynak (1998) |

**Action items:** add a `THIRD_PARTY_NOTICES.md` listing these licences, state in the README that the project is AGPL-compatible because of YOLOv8, and confirm the Mixamo and FFmpeg build terms.
