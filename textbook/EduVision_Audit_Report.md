# EduVision Repository Audit Report

## 1. Executive Summary
This audit compares the current `Major Project - MVP2` repository against the proposed EduVision High-Level System Architecture. The existing repository contains a functional, highly specialized pipeline for "Story Studio" (character extraction, motion generation, and story rendering). However, it currently operates as a standalone prototype rather than a modular platform. The required shared services for a multi-application EduVision platform—such as authentication, database-backed state, user roles, and a generalized integration contract—do not yet exist. 

The immediate next steps involve establishing these shared platform fundamentals without breaking the existing, heavily optimized Python Story Engine.

## 2. Actual Repository Architecture
Based on code inspection, the current architecture is structured as follows:
*   **Frontend & API (`eduvision_ui/`)**: A Node.js/Express server (`server.js`) that serves static HTML/JS/CSS files and provides API endpoints specifically tied to the storytelling workflow. It handles file uploads via `multer` and triggers Python ML scripts via `child_process.spawn`. 
*   **Story Orchestrator (`story_engine/`)**: Python scripts that manage the workflow between the web server and the ML core. It handles background character preparation (`batch_animate.py`) and scene compositing (`compose_story.py`).
*   **ML Core (`Actual repo (EDUVISION)/AnimatedDrawings/`)**: A modified fork of Meta's AnimatedDrawings, incorporating YOLOv8 pose estimation, custom Mixamo retargeting, and ARAP mesh deformation.

## 3. User Journeys Supported Today vs. Target Journeys
*   **Current Supported Journey**: The UI allows a user (implicitly acting as a teacher or child) to upload a sketch, fix the generated skeleton (via `fixer.html`), assign characters to story slots, and render a final story video (via `story.html`).
*   **Target Journeys Missing**: 
    *   **Teacher Journey**: No concept of "Sign in", "Select class", or "Assign related activity".
    *   **Parent Journey**: No read-only portal or linked child accounts.
    *   **Student Journey**: No isolated or supervised learning hub.

## 4. Existing Applications and Their Current Status
*   **Story Studio**: **Existing and verified (via code inspection)**. The engine is capable of extraction, caching, and MP4 generation. It acts as the entire application currently.
*   **Matching Activities**: **Not implemented**.
*   **Other Educational Apps**: **Not implemented**.

## 5. Shared Services That Already Exist
*   **Identity and access**: **Not implemented**. No authentication mechanisms are present.
*   **Users and classrooms**: **Not implemented**. No relational data or schemas exist.
*   **Application registry**: **Not implemented**.
*   **Assignment & Progress**: **Not implemented**.
*   **File and media storage**: **Partially implemented (Local only)**. Images, GIFs, and MP4s are stored directly in the `eduvision_ui/uploads/` and `story_engine/output/` directories without access controls or a dedicated media service.
*   **Job management**: **Partially implemented (In-memory)**. `server.js` maintains a simple, volatile Javascript dictionary (`const jobs = {}`) that will be lost on server restart.

## 6. Story Engine Boundaries and Current Integration
The Python Story Engine is currently well-segregated in terms of folder structure (`story_engine/` and `AnimatedDrawings/`), but tightly coupled operationally to the Express server. 
*   **Integration Method**: The Express server directly spawns Python processes using CLI arguments and parses `stdout` to read JSON progress logs. 
*   **Caching & Optimization**: The codebase contains critical, verified optimizations (e.g., `end_frame_idx: 90` to truncate generation, and background detaching via subprocesses) to prevent UI freezing. These optimizations **must be preserved** during platform migration.

## 7. Data Ownership, Database, Storage, and Job Architecture
*   **Database**: **Not implemented**. There is no PostgreSQL connection, ORM, or schema defined in `package.json` or `server.js`.
*   **Storage**: Currently relies strictly on the local filesystem. 
*   **Jobs**: Relies on an in-memory dictionary. There is no durable queue (e.g., Redis, RabbitMQ, or DB-backed queues).

## 8. Gaps Between Current Implementation and Target Architecture
1.  **Monolithic Design**: The Node.js server is built exclusively for Story Studio. It cannot currently route to or host a second, unrelated educational application.
2.  **No Persistence Layer**: The absence of a database means users, classes, and job states cannot be durably stored.
3.  **Lack of Security**: API endpoints lack authorization checks. Media files are served via static file hosting without ownership validation.
4.  **No Formal Integration Contract**: Applications cannot "register" themselves or report agnostic completion scores to the platform.

## 9. Risks and Dependencies
*   **Engine Fragility**: The ARAP deformation and custom retargeting in `AnimatedDrawings` are mathematically complex and CPU-bound. Any refactoring that accidentally drops the `end_frame_idx` truncation or alters the retargeting YAML configurations will cause severe performance degradation or rendering failures.
*   **Zombie Processes**: Direct process spawning via Node.js risks orphaned Python processes if the Node server crashes. A dedicated task queue (e.g., BullMQ) is recommended in the future.
*   **Lack of Test Coverage**: There are no automated unit or integration tests (Mocha, Jest, PyTest) found in the repository, making refactoring high-risk.

## 10. Recommended Phased Implementation Plan
*   **Phase 0**: Architecture and repository audit. *(Completed)*
*   **Phase 1**: Stabilize and verify existing engine boundaries. Add lightweight test harnesses (if approved) to ensure current Story Studio behaviors (extraction, animation, rendering) are protected before moving them.
*   **Phase 2**: Introduce the PostgreSQL database. Implement the Shared Platform Foundation: Authentication, Users, Classes, and Role-Based Access Control (RBAC).
*   **Phase 3**: Define the Application Integration Contract. Build the Application Registry, Assignments, and generalized Progress reporting endpoints.
*   **Phase 4**: Refactor Story Studio to integrate through the new Phase 3 contracts. Move its local filesystem logic behind authorized endpoints. Migrate in-memory jobs to durable tracking.
*   **Phase 5**: Integrate the next independently developed application (e.g., Matching Activities) to prove the platform's multi-app capability.
*   **Phase 6**: Harden security, migrate to object storage (S3), and implement monitoring.

## 11. Proposed Acceptance Tests for Each Major Phase
*   **Phase 1 Acceptance**: The existing Python engine can be triggered via a decoupled script and returns a valid video without relying on the current `server.js` state.
*   **Phase 2 Acceptance**: A teacher can log in, create a class, add a student, and a parent can log in to view only their linked child. Unauthorized data access returns HTTP 403.
*   **Phase 3 Acceptance**: An API endpoint allows querying available applications and creating an assignment for a specific class.
*   **Phase 4 Acceptance**: A teacher can launch Story Studio *as an assignment*, the engine renders the video using durable job queues, and the video reference is saved to the PostgreSQL database under the student's progress record.
*   **Phase 5 Acceptance**: A simple Matching App can be registered and launched; a student completes a match, and the score is successfully reported back to the platform's Progress service without modifying the platform backend.

## 12. Open Decisions That Require Approval
1.  **Frontend Framework Selection**: The target architecture mentions React/Next.js, but the current UI uses Vanilla HTML/JS. Should we implement the new platform portal in Next.js, or continue with Vanilla JS for the MVP?
2.  **Database Migration Tool**: Do you have a preferred ORM or query builder (e.g., Prisma, Sequelize, raw pg) for the new PostgreSQL integration?
3.  **Testing Strategy**: Given the lack of existing automated tests, should Phase 1 include setting up Jest/PyTest to create a safety net for the Story Engine before platform integration begins?
