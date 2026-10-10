# Developer Walkthrough

## Important Folders & Entry Points
- `platform/api/`: The central API. Entry point is `server.js` (initializes logging and starts express) and `app.js` (registers routes). 
- `platform/api/routes/`: Route definitions (`auth.js`, `apps.js`, `portal.js`, `integration.js`).
- `platform/portal/src/`: The React UI. Entry point is `main.jsx` and `App.jsx`.
- `platform/student-story-studio/`: The Replica Story Studio UI. Entry point is `server.js` (proxy) and `public/index.html`.
- `eduvision_ui/`: The legacy Python Engine. Entry point is `server.js`. **Do not modify files in here casually**, especially Python scripts (`compose_story.py`, etc.).

## How the Portal Communicates with the API
The Portal (`platform/portal`) uses a centralized `apiFetch()` utility wrapper around the native browser `fetch`.
This utility automatically:
1. Injects the `Authorization: Bearer <jwt>` header stored in `localStorage`.
2. Appends `X-Correlation-Id` headers to ensure requests can be traced from the browser straight through the backend logs.
3. Automatically parses JSON and throws standardized HTTP errors.

## Authentication, Authorization, and Launches
1. **Authentication**: Users receive a JWT signed by `JWT_SECRET` via `/api/auth/login` or the passwordless student route `/api/auth/student-login`.
2. **Authorization**: API endpoints are guarded using the `authenticate` middleware, followed by the `authorize(['TEACHER', 'ADMIN'])` middleware which reads the user's role from the JWT payload.
3. **Application Launches**: When a student launches an app, the API's `/api/integrations/launch` route validates that the assignment belongs to them, mints a short-lived "integration token" containing their student ID and the assignment ID, and redirects the browser to the app's registered `launchUrl`.

## How Story Studio Generates and Saves Stories
1. The student clicks "Make a Story" in the Replica UI (`platform/student-story-studio`).
2. The Replica issues an API request to its proxy `/api/story/generate`.
3. The request is forwarded transparently to the Legacy Engine (`eduvision_ui` on port 3000) preserving the `X-Correlation-Id`.
4. The Python engine processes the story and returns a polling URL. Once complete, it provides the `finalVideoUrl`.
5. The Replica UI extracts this `finalVideoUrl` and instantly sends it alongside the integration token to `/api/integrations/results` in the Platform API to mark the assignment complete and save the story.

## Adding Another Educational Application
To add a new app (like `math-blaster`):
1. Build the app as a standard HTML/JS page.
2. In the app, parse the `token` parameter from the URL querystring when the app boots: `new URLSearchParams(window.location.search).get('token')`.
3. When the student completes the game, send a `POST` request to `http://localhost:4000/api/integrations/results` with `Authorization: Bearer <token>` and `{ score: 100 }` in the body.
4. Register the app in the PostgreSQL `Application` table with the correct `launchUrl`.

## Tracing Requests (Logging)
Every request generates a UUID (`X-Correlation-Id`). 
To debug an issue:
1. Open the browser's developer tools (Network tab) and look at the failed request's headers to find `X-Correlation-Id`. (e.g. `1234-abcd`).
2. Open `platform/api/logs/api-info.log` or `api-error.log`.
3. Search for the Correlation ID. You will see the exact sequence of events, SQL queries, and middleware states that executed during that specific request.
