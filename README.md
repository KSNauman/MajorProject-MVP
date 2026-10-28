# EduVision ✨
### Intelligent, Child-Centric AI Educational Platform & Animation Ecosystem

[![Node.js](https://img.shields.io/badge/Node.js-18+-68a063?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-646cff?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4+-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5+-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab?style=flat-square&logo=python)](https://python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-CUDA_12.1-ee4c2c?style=flat-square&logo=pytorch)](https://pytorch.org/)

---

## 🌟 1. Core Idea & Vision

**EduVision** is a unified, multi-service educational ecosystem engineered specifically for early-childhood learning (K-5). It bridges computer vision AI and pedagogical gameplay into a cohesive, secure platform where children learn through play and creative storytelling.

### The Problem
Traditional educational software is often fragmented, overly rigid, and friction-heavy for young kids. Children struggle with alphanumeric passwords, teachers are weighed down by administrative account chores, and parents lack visibility into their children's creative achievements.

### The EduVision Solution
1. **AI-Driven Creativity (Living Story Studio)**: Children's sketches and humanoid character drawings (such as *Rahim & Family*) are brought to life as animated `.mp4` video stories using cutting-edge Computer Vision (YOLO segmentation, MediaPipe landmark extraction, and Meta's AnimatedDrawings As-Rigid-As-Possible retargeting engine).
2. **Engaging Humanoid Activities**: A suite of interactive, curriculum-aligned games (Coloring Studio, Color Matching, Shape Detective, Counting, Jigsaw Puzzle, and Train Builder) designed with kid-first psychology, rich visuals, and Web Audio.
3. **Passwordless, Child-Friendly Authentication**: Young children never have to remember passwords. They simply pick their classroom and tap their friendly robot avatar to enter.
4. **Strict Separation of Concerns (Role Architecture)**:
   - **Admin**: Central authority managing school rosters, bulk CSV onboarding, parent-child linking, and account lifecycles.
   - **Teacher**: Purely pedagogical—creates classes, assigns activities, tracks student completion, and deletes classes/assignments as needed.
   - **Parent**: Frictionless window into their children's learning journey—viewing assigned tasks, completed video stories, and scores.
   - **Student**: Distraction-free, colorful dashboard with immediate access to homework assignments and a sandbox "🎡 Play for Fun!" free-play mode.

---

## 🏛️ 2. System Architecture

EduVision follows a decoupled, service-oriented micro-frontend and micro-backend architecture.

### High-Level Topology

```mermaid
flowchart TD
    subgraph Clients["User Tier (Browsers)"]
        ChildBrowser["👦 Student Browser"]
        TeacherBrowser["👩‍🏫 Teacher / Admin Browser"]
        ParentBrowser["👨‍👩‍👧 Parent Browser"]
    end

    subgraph Frontends["Frontend & Micro-Apps"]
        Portal["🖥️ React Portal<br/>(Port 5173)<br/>Admin / Teacher / Parent / Student"]
        StoryReplica["📖 Story Studio Replica<br/>(Port 3001)<br/>Student Story Maker"]
        ActivityCenter["🎨 Activities Center<br/>(Port 5000)<br/>7 Humanoid Learning Games"]
    end

    subgraph CoreBackend["Central Platform Tier"]
        PlatformAPI["⚙️ Platform Express API<br/>(Port 4000)<br/>RBAC, Auth, JWT Registry, Admin Routes"]
        Postgres[("🐘 PostgreSQL DB<br/>(Port 5432)<br/>Prisma ORM Models")]
    end

    subgraph AIStoryTier["AI Engine & Video Pipeline"]
        StoryEngine["🎬 Story Engine Server<br/>(Port 3000)<br/>Node.js Proxy & Job Queue"]
        PythonAI["🧠 Python AI Story Service<br/>(CUDA / PyTorch)<br/>YOLO + MediaPipe + AnimatedDrawings"]
    end

    ChildBrowser --> Portal
    TeacherBrowser --> Portal
    ParentBrowser --> Portal

    Portal -->|REST / JWT| PlatformAPI
    PlatformAPI -->|Prisma Client| Postgres

    Portal -->|Launches with JWT token| StoryReplica
    Portal -->|Launches with JWT token or Fun Mode| ActivityCenter

    StoryReplica -->|Proxies Story Jobs| StoryEngine
    StoryEngine -->|Subprocess / IPC| PythonAI
    StoryReplica -->|Submits Video URL + Token| PlatformAPI
    ActivityCenter -->|Reports Score + Token| PlatformAPI
```

---

### The 5 Subsystems

| Service | Port | Technology | Purpose |
| :--- | :---: | :--- | :--- |
| **Platform Portal** | `5173` | React 18, Vite, CSS Modules | Single-Page Application housing role-based dashboards (Admin, Teacher, Parent, Student). |
| **Platform API** | `4000` | Express.js, Prisma ORM, JWT, Winston | Central authoritative backend handling authentication, RBAC, database persistence, and integration token minting. |
| **Activities Center** | `5000` | Express.js, HTML5 Canvas, Web Audio, KNN | Modular suite of 7 interactive humanoid educational mini-games and free-play playground. |
| **Story Studio Replica** | `3001` | Express.js, Vanilla JS, HTML5 Video | Student-facing story maker wrapping the AI engine inside the platform integration contract. |
| **Story Studio Engine** | `3000` | Express.js, Python 3.10+, PyTorch CUDA | AI pipeline executing segmentation, pose landmark extraction, ARAP mesh retargeting, and MP4 rendering. |

---

### Application Integration Contract & JWT Flow

EduVision isolates third-party and internal mini-apps behind a secure, stateless **Integration Contract**:

```mermaid
sequenceDiagram
    autonumber
    actor Student as 👦 Student
    participant Portal as 🖥️ Portal (5173)
    participant API as ⚙️ Platform API (4000)
    participant DB as 🐘 PostgreSQL
    participant App as 🎮 Activity / Story App (3001 / 5000)

    Student->>Portal: Clicks "Start ▶️" on Assignment
    Portal->>API: POST /api/integrations/launch { assignmentId, appId }
    API->>DB: Verify student assignment & application registry
    API-->>Portal: Returns signed JWT launch URL (?token=...)
    Portal->>App: Redirects student with token in query string
    App->>App: Extracts & validates session token
    Student->>App: Completes game or generates story video
    App->>API: POST /api/integrations/results (Bearer <token>, { score, videoUrl, storyTitle })
    API->>DB: Validates JWT signature, updates Assignment & saves StudentStory
    API-->>App: 200 OK (Persisted)
    App-->>Student: Displays completion animation / autoplays video!
```

---

### Role-Based Access Control (RBAC)

| Capability | ADMIN | TEACHER | PARENT | STUDENT |
| :--- | :---: | :---: | :---: | :---: |
| **Passwordless Avatar Login** | ❌ | ❌ | ❌ | ✅ |
| **Standard Login (User / Pass)** | ✅ | ✅ | ✅ | ❌ |
| **Bulk CSV Student Onboarding** | ✅ | ❌ | ❌ | ❌ |
| **Parent-Child Family Linking** | ✅ | ❌ | ❌ | ❌ |
| **Delete Accounts (Student / Parent)** | ✅ | ❌ | ❌ | ❌ |
| **Create & Delete Classes** | ✅ | ✅ | ❌ | ❌ |
| **Assign & Delete Activities** | ❌ | ✅ | ❌ | ❌ |
| **View Child Stories & Scores** | ❌ | ✅ | ✅ | ✅ |
| **Free-Play ("Play for Fun!")** | ❌ | ❌ | ❌ | ✅ |

---

## 📁 3. Project Structure

```text
Major-Project/
├── eduvision_ui/                     # Port 3000: Legacy AI Story Engine server & public assets
│   ├── public/                       # Story studio interface, canvases, and fixer
│   └── server.js                     # Story rendering proxy & job coordinator
├── platform/
│   ├── activity-center/              # Port 5000: Interactive Humanoid Games Hub
│   │   ├── public/
│   │   │   ├── activities/           # color-filling, matcher, shape-spotter, etc.
│   │   │   ├── uploads/              # Pre-generated animated humanoid assets
│   │   │   └── index.html            # Hub launcher & category filter
│   │   └── server.js
│   ├── api/                          # Port 4000: Core Express Backend
│   │   ├── prisma/                   # schema.prisma & PostgreSQL migrations
│   │   ├── routes/
│   │   │   ├── admin.js              # Bulk onboarding, parent linking, directories
│   │   │   ├── auth.js               # Dual-login (username/displayName) & JWT issuance
│   │   │   ├── integration.js        # Launch token minting & score submission
│   │   │   └── portal.js             # Classes, rosters, assignments, student stories
│   │   ├── seed.js                   # Baseline database seeder
│   │   └── server.js                 # API server entrypoint with correlation logging
│   ├── portal/                       # Port 5173: React Single Page Application
│   │   ├── src/
│   │   │   ├── App.jsx               # Dashboards: Admin, Teacher, Parent, Student
│   │   │   └── index.css             # Unified kid-friendly CSS design system
│   │   └── package.json
│   └── student-story-studio/         # Port 3001: Integrated Story Studio Replica
│       ├── public/                   # story.html with JWT contract integration
│       └── server.js
├── story_engine/                     # Core Python AI Computer Vision Engine
│   ├── ai_server.py                  # PyTorch/CUDA model server
│   ├── batch_animate.py              # Multi-scene animation compiler
│   ├── compose_story.py              # Video compositor & audio sync
│   └── robust_extract_api.py         # YOLO & MediaPipe pose extractor
├── characters/                       # Character definitions (Rahim, Sister, Parents, Grandparents)
├── docs/                             # In-depth architectural & developer guides
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── DEVELOPER_WALKTHROUGH.md
│   └── USER_WALKTHROUGH.md
├── start-eduvision.bat               # One-click launch script for all 5 services
└── stop-eduvision.bat                # Safe shutdown script for all services
```

---

## ⚡ 4. Prerequisites & Requirements

### System Requirements
- **OS**: Windows 10/11, macOS, or Linux
- **RAM**: 8 GB minimum (16 GB recommended for local video rendering)
- **GPU (Optional)**: NVIDIA RTX (CUDA 12.1 compatible) for hardware-accelerated pose estimation and 10x faster video compilation. *CPU fallback is supported automatically.*

### Software Dependencies
- **Node.js**: `v18.0.0+`
- **npm**: `v9.0.0+`
- **PostgreSQL**: `v14+` (Service active on `localhost:5432`)
- **Python**: `3.10+` with PyTorch (Recommended: Anaconda / Miniconda)

---

## 🚀 5. Setup & Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/KSNauman/MajorProject-MVP.git
cd MajorProject-MVP
```

### Step 2: Configure Environment Variables
Create `platform/api/.env` (or copy from `.env.example`):
```ini
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/eduvision?schema=public"
JWT_SECRET="eduvision-super-secret-key-change-in-production"
```

### Step 3: Install Node Dependencies
Run the install command across all microservices:
```bash
# Platform API
cd platform/api && npm install && cd ../..

# React Portal
cd platform/portal && npm install && cd ../..

# Student Story Studio Replica
cd platform/student-story-studio && npm install && cd ../..

# Activities Center
cd platform/activity-center && npm install && cd ../..

# Legacy Engine UI
cd eduvision_ui && npm install && cd ..
```

### Step 4: Initialize and Seed PostgreSQL Database
Ensure your PostgreSQL server is running, then run Prisma migrations and the baseline seed script:
```bash
cd platform/api
npx prisma migrate dev --name init
node seed.js
cd ../..
```

### Step 5: (Optional) Python AI Story Engine Setup
If you plan to render new animated characters locally:
```bash
# Activate your Python 3.10+ conda environment
conda activate eduvision

# Install PyTorch with CUDA (or CPU)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install opencv-python mediapipe ultralytics pyyaml
```

---

## 🎮 6. Running EduVision

### Option A: One-Click Startup (Recommended on Windows)
Simply double-click or run:
```cmd
.\start-eduvision.bat
```
*The startup script automatically:*
1. Verifies Node, npm, and required project files.
2. Checks and starts the PostgreSQL Windows service if stopped.
3. Clears any orphaned processes on ports `4000, 5173, 5000, 3000, 3001`.
4. Launches all 5 servers in organized, dedicated command windows.
5. Automatically opens `http://localhost:5173` in your default browser.

### Option B: Stopping All Services
```cmd
.\stop-eduvision.bat
```
Gracefully terminates all Node and Python processes tied to EduVision ports.

---

## 🔑 7. Default Credentials (Seeded)

The database seed provides standard administrative and demo accounts:

| Role | Username / Identifier | Password | Access / Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `password123` | Full school administration, bulk onboarding, parent-child linking. |
| **Teacher** | `teacher1` | `password123` | Classroom management, student roster assignment, grading. |
| **Parent** | `parent1` *(or "Parent User")* | `password123` | Viewing linked child activities, stories, and performance. |
| **Student** | *Passwordless* | *None* | Select Class ➔ Click Avatar ➔ Instant Play! |

> [!TIP]
> The auth service supports logging in with either your **username** (e.g. `parent1`, `admin`) or your **Display Name** (e.g. `Parent User`, `Robert Davis`).

---

## 🎨 8. The AI Story Engine Pipeline

The animation engine retargets 2D drawings into rich, expressive character animations:

```text
[Drawing / Sketch]
       │
       ▼
1. YOLO Segmentation ─────────► Extracts character alpha mask & separates background
       │
       ▼
2. MediaPipe Pose ────────────► Identifies 15 key joint coordinates (head, shoulders, elbows, knees)
       │
       ▼
3. ARAP Mesh Retargeting ─────► Builds 2D triangle mesh & applies As-Rigid-As-Possible deformation
       │
       ▼
4. BVH Motion Transfer ──────► Applies pre-recorded motion capture sequences (jump, wave, walk)
       │
       ▼
5. Video Composition ─────────► Combines animated character, backgrounds, and audio into final .mp4
```

---

## 🛠️ 9. API Reference Summary

### Core Platform Endpoints (`http://localhost:4000`)

- **Authentication**
  - `POST /api/auth/login` - Standard login for Admin, Teacher, and Parent.
  - `POST /api/auth/student-login` - Avatar-based passwordless login for students.
- **Admin Management**
  - `POST /api/admin/bulk-onboard` - Mass-creates students, parents, and links from CSV/text.
  - `GET /api/admin/overview` - Fetches school-wide counts, student list, and parent directory.
  - `DELETE /api/admin/students/:id` - Deletes a student account and class memberships.
  - `DELETE /api/admin/parents/:id` - Deletes a parent account and unlinks family associations.
  - `POST /api/admin/link-parent-child` - Pairs a parent account with a student.
- **Teacher & Classroom**
  - `GET /api/portal/classes` - Lists teacher's classes.
  - `POST /api/portal/classes` - Creates a new classroom.
  - `DELETE /api/portal/classes/:id` - Deletes an existing class and cascades assignments.
  - `POST /api/portal/assignments` - Assigns an activity to a class or individual student.
  - `DELETE /api/portal/assignments/:id` - Deletes an assigned activity.
- **Integrations Contract**
  - `POST /api/integrations/launch` - Mints a signed JWT launch URL for an assigned activity.
  - `POST /api/integrations/results` - Micro-apps submit completed scores and video URLs.

---

## 🧪 10. Automated Testing

To run the platform backend test suite:
```bash
cd platform/api
npm test
```
The test suite covers:
- User authentication & role permission enforcement.
- Integration contract token signing & result reporting.
- Student story persistence & security boundary validation.
- Request correlation ID logging across microservices.

---

## 👥 Authors & Acknowledgements
- Developed for the **Major Project** initiative.
- Core Motion Engine powered by [Meta AnimatedDrawings](https://github.com/facebookresearch/AnimatedDrawings).
- Pose estimation via [Google MediaPipe](https://developers.google.com/mediapipe).
- Object segmentation via [Ultralytics YOLO](https://github.com/ultralytics/ultralytics).
