# EduVision Setup Guide

## System Requirements
- **OS**: Windows 10/11 (Development Environment)
- **Node.js**: v18+ (Verified v24.14.1 locally)
- **npm**: v9+
- **Python**: 3.10+ (Requires Anaconda/Miniconda for TorchServe environment)
- **PostgreSQL**: v14+ (Verified v16 locally)

## Repository Structure
```text
C:\Major Project - MVP2\Major Project - MVP\
├── docs/                   # Project documentation
├── platform/               # Shared Platform Foundation
│   ├── api/                # Express API (Port 4000)
│   ├── portal/             # React/Vite UI (Port 5173)
│   ├── student-story-studio/ # Replica Story Engine App (Port 3001)
│   └── sample-app/         # Sample Math Blaster app
├── eduvision_ui/           # Original Story Studio UI & Engine Wrapper (Port 3000)
├── story_engine/           # Python Engine scripts
└── Actual repo (EDUVISION)/# Core machine learning resources
```

## Environment Variables
Create a `.env` file in `platform/api/`. Use the provided `platform/api/.env.example` as a template:
```env
# platform/api/.env
PORT=4000
DATABASE_URL="postgresql://postgres:<your_password>@localhost:5432/eduvision_dev"
JWT_SECRET="<your_secure_random_string>"
NODE_ENV="development"
```
**CRITICAL**: Never commit `.env` to version control. It is explicitly ignored in `.gitignore`.

## Database Setup
1. Ensure PostgreSQL is running (`postgresql-x64-18` or similar service).
2. Open `psql` or pgAdmin and create the database:
   ```sql
   CREATE DATABASE eduvision_dev;
   ```
3. Navigate to `platform/api/` and run the migrations:
   ```bash
   cd platform/api
   npx prisma migrate dev --name init
   ```
4. Seed the database with the required roles, apps, classes, and students:
   ```bash
   node seed.js
   ```

## Installation
Run `npm install` in each of the following directories:
1. `platform/api`
2. `platform/portal`
3. `platform/student-story-studio`
4. `eduvision_ui`

## Starting the Application
You can start all components simultaneously using the root launch script:
```cmd
.\start-eduvision.bat
```
*(To stop all services gracefully, run `.\stop-eduvision.bat`)*

### Starting Services Individually
If you need to debug a specific component, run them in separate terminal windows:
- **API**: `cd platform/api && npm run dev`
- **Portal**: `cd platform/portal && npm run dev`
- **Story Studio Replica**: `cd platform/student-story-studio && node server.js`
- **Python Engine Server**: `cd eduvision_ui && node server.js`

## Verifying Services
- **Platform API**: `http://localhost:4000/api/health`
- **Platform Portal**: `http://localhost:5173/`
- **Story Studio Replica**: `http://localhost:3001/`
- **Story Engine**: `http://localhost:3000/`

If you encounter issues, refer to `TROUBLESHOOTING.md`.
