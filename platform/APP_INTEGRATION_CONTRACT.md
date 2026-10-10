# EduVision Application Integration Contract

This document defines the minimal contract for integrating independent educational applications (such as Story Studio or future apps) into the EduVision platform.

## 1. App Manifest (`manifest.json`)
Every application must define a manifest containing:
```json
{
  "appId": "unique-app-identifier",
  "name": "App Name",
  "version": "1.0.0",
  "launchPath": "https://url-to-app.com/launch",
  "permissions": ["report_results", "read_user_profile"]
}
```

## 2. Launching an App
The EduVision Portal launches an app by redirecting the user or loading the app in an iframe using the `launchPath` from the manifest. 
Context is passed securely via URL query parameters, utilizing a short-lived, app-specific JWT.

**Example Launch URL:**
`https://url-to-app.com/launch?token=<SHORT_LIVED_JWT>&assignmentId=<OPTIONAL_ID>`

The `<SHORT_LIVED_JWT>` contains the user's ID, role, and authorized `appId`.

## 3. Reporting Activity Results
Apps that require grading or progress tracking can report results back to the EduVision API.

**Endpoint:** `POST /api/integrations/results`
**Headers:** `Authorization: Bearer <SHORT_LIVED_JWT>`
**Payload:**
```json
{
  "assignmentId": "uuid-of-assignment",
  "score": 85,
  "status": "COMPLETED",
  "details": {
    "timeSpent": 120,
    "milestones": ["level1", "level2"]
  }
}
```

## 4. Server-Side Authorization
The EduVision API enforces the following:
- The token must be valid and unexpired.
- The token's `appId` must match the application attempting to report results.
- The `assignmentId` must belong to the authenticated user.
*(Note: Database-dependent validations are marked in the code and require a live PostgreSQL configuration).*
