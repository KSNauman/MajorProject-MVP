# EduVision Platform

This directory contains the initial platform foundation for EduVision, supporting multiple educational applications through shared identity, state, and API routing.

## Architecture
- **Web Portal** (`/web` or `/portal`): A new React + Vite frontend serving as the unified entry point.
- **Shared API** (`/api`): Node.js + Express backend providing auth, user context, assignments, and progress tracking.
- **Database**: PostgreSQL (via Prisma ORM) handling normalized entity data.

## Setup Instructions

### 1. Database Configuration
Ensure you have PostgreSQL running. Create a new database named `eduvision`.
Copy `.env.example` to `.env` in the `/api` directory and adjust the `DATABASE_URL`:
```
DATABASE_URL="postgresql://username:password@localhost:5432/eduvision?schema=public"
```

### 2. API Setup
```bash
cd platform/api
npm install
npx prisma generate
npx prisma db push
npm start
```
*Note: The API runs on port 4000 by default.*

### 3. Portal Setup
```bash
cd platform/portal
npm install
npm run dev
```

## Running Tests
To verify the API health and basic auth middleware:
```bash
cd platform/api
npx jest tests/api.test.js
```
