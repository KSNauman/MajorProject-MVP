# User Walkthrough

This document outlines the actual user journey currently supported by the EduVision platform.

## 1. Teacher/Admin Access
1. Open the portal at `http://localhost:5173/`.
2. Click **Teacher Login**.
3. Log in with the credentials `admin` / `password`.
4. You will see the **Teacher Dashboard**.

### Managing Classes and Assignments
*(Currently, class creation and assignment creation are managed via direct API endpoints or the database seed scripts. UI buttons for "Create Class" and "Create Assignment" trigger backend API calls if hooked up, or can be tested via `POST /api/portal/classes` using tools like Postman.)*

## 2. Student Access
1. Open the portal at `http://localhost:5173/`.
2. Click **I'm a Student! 🎒**.
3. **Select Class**: Click on your classroom (e.g., "Kindergarten Yellow").
4. **Select Avatar**: Click your name/avatar card (e.g., "Alice" or "Bobby").
5. You will bypass passwords and be securely logged into your Student Dashboard.

## 3. Viewing and Launching Apps
1. On the Student Dashboard, you will see a list of your assigned activities.
2. Applications that are flagged `isReady: false` in the database (like Math Blaster Sample) will show a disabled **"Coming Soon 🚧"** button. You cannot launch these.
3. For ready applications like **Story Studio**, click **Start ▶️**.
4. The platform securely redirects you to the app, passing your identity and assignment data in the background.

## 4. Generating a Story and Playing Video
1. Once redirected to Story Studio, click **Make a Story 🌟**.
2. A progress bar will track the backend Python engine's generation steps (e.g., "Queued", "Generating Animation", "Composing Scene").
3. Once completed, the final video will automatically appear and prompt you to play it.
4. The system silently informs the backend that the assignment is complete.

## 5. Viewing Saved Stories
1. Return to the Student Dashboard (close the Story Studio).
2. The assignment card for Story Studio will now be highlighted in green and marked **"Done ✅"**.
3. You can click **View My Stories 🎬** on the dashboard to see a historical list of every story you've successfully generated, allowing you to replay them at any time.
