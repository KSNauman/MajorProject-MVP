# Testing Guide

## Backend API Tests

The central Platform API is heavily tested using Jest and Supertest.

1. Navigate to the API directory:
   ```bash
   cd platform/api
   ```
2. Run the test suite:
   ```bash
   npm test
   ```

### Test Suites Included
- **Unit & Route Tests (`tests/api.test.js`)**: Tests health endpoints, offline fallbacks, JWT validation, public class roster listing, passwordless student logins, cross-student security boundaries, and teacher operations.
- **Integration Tests (`tests/integration.test.js`)**: Tests the Application Integration Contract. It seeds actual database fixtures (Users, Apps, Classes, Assignments), verifies secure token issuance (`/api/integrations/launch`), tests robust rejection of cross-assignment forgeries, and validates real persistence of incoming activity results (`/api/integrations/results`). It safely destroys its own fixtures using `afterAll` to prevent database pollution.

## End-to-End Functional Tests
The Student Story Studio Replica contains real end-to-end (E2E) tests that interact with the live Python engine.

1. **Prerequisite**: The Legacy Python engine must be running on Port 3000 (`cd eduvision_ui && node server.js`).
2. Navigate to the Replica:
   ```bash
   cd platform/student-story-studio
   ```
3. Run the E2E suite:
   ```bash
   npm test
   ```
*(This triggers a real Python generation job in the background and verifies that the polling sequence works and that the final `.mp4` URL successfully returns a 200 OK media stream.)*

## Manual Smoke-Test Checklist
If testing manually, follow these steps without destroying data:
1. Start all components using `start-eduvision.bat`.
2. Visit `http://localhost:5173/` and login as a Student (Select a class -> Select an Avatar).
3. Verify the Dashboard loads assignments.
4. Verify clicking a disabled app shows "Coming Soon".
5. Verify clicking **Start ▶️** on Story Studio successfully loads the UI on Port 3001.
6. Verify clicking **Make a Story** proceeds smoothly to a video player without console errors.
7. Verify playback works (clicking the interactive play button if autoplay is blocked).
8. Close the app and verify the Student Dashboard marks the assignment as **Done ✅**.
