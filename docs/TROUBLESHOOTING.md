# Troubleshooting Guide

## Service Startup and Port Conflicts
- **Symptom:** Running `npm run dev` yields `EADDRINUSE`.
- **Solution:** Another process is already using the required port. Use the `diagnostics.js` script or standard OS tools (e.g. `netstat -ano | findstr :4000`) to find the process ID and terminate it, or run `.\stop-eduvision.bat`.

## PostgreSQL and Prisma Connection Errors
- **Symptom:** The API fails to start with `PrismaClientInitializationError` or `P1001`.
- **Solution:** 
  1. Verify the PostgreSQL service (`postgresql-x64-16` or similar) is running in the Windows Services app.
  2. Verify your `.env` contains the correct database URL and password.
  3. Run `npx prisma db pull` or `npx prisma db push` to verify basic connectivity.

## Authentication and Authorization Failures
- **Symptom:** API returns `401 Unauthorized` or `403 Forbidden`.
- **Solution:** 
  1. Check the browser Network tab. Ensure the `Authorization: Bearer <token>` header is present.
  2. If using an app, check if the JWT has expired (tokens are short-lived, usually 1 hour).
  3. Ensure the User Role (`STUDENT` vs `TEACHER`) is appropriate for the endpoint requested.

## Story Generation Failures
- **Symptom:** Generation stops at a specific stage or returns an error.
- **Solution:** 
  1. The legacy engine relies on Python `subprocess` executions.
  2. Inspect the engine's standard output where `node server.js` is running (Port 3000).
  3. Verify `TorchServe` is running and accessible if pose estimation is failing.

## Video URL and Playback Failures
- **Symptom:** "Error: Failed to load the video resource" or `404 Not Found` / `403 Forbidden` on media assets.
- **Solution:** 
  1. The Proxy middleware (`localhost:3001` -> `localhost:3000`) handles routing `/api/files?path=...`.
  2. The Legacy engine utilizes a strict, case-insensitive `.startsWith` validation on paths. Ensure the drive letter and absolute path of the returned video match the engine directory boundaries.
  3. Autoplay is strictly managed. If `video.play()` fails due to browser restrictions, an interactive UI play button handles playback recovery automatically.

## Logs and Diagnostics
- **Logs Location:** 
  - API Logs: `platform/api/logs/api-info.log` and `api-error.log`
  - Replica Logs: `platform/student-story-studio/logs/api-info.log`
- **Tail Logs:** Use the provided PowerShell script: `.\tail-logs.ps1`
- **Diagnostics Script:** Run `node diagnostics.js` (if created) in the root or manually ping `http://localhost:4000/api/health` to verify components.
- **Reporting a Defect:** Always capture the `X-Correlation-Id` string (found in UI popups or Network Headers) and provide the exact lines from the `logs/` file containing that ID.
