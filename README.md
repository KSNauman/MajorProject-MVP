# EduVision

EduVision is a unified, student-centric educational platform designed for young children. It provides a shared foundation (authentication, assignments, identity, and application registry) that securely integrates multiple distinct educational applications, including the legacy Python-powered Story Engine.

## Current Project Status
**Phase 1-10 Completed**. The core platform foundation, database migrations, application registry, and strict security boundaries are fully operational. The Student Portal is currently functional and strictly enforces role-based constraints and passwordless avatar-based login. The core Story Studio has been wrapped into a seamless EduVision integration and successfully generates, persists, and plays back `.mp4` stories to the specific logged-in student.

## Verified Prerequisites
- **Node.js**: v18+
- **PostgreSQL**: v14+ (Local service running on port 5432)
- **Python**: 3.10+ (Anaconda/Miniconda required for the legacy Story Engine)

## Quick Start
1. Ensure PostgreSQL is running.
2. Initialize and seed the database:
   ```bash
   cd platform/api
   npx prisma migrate dev --name init
   node seed.js
   ```
3. Use the root batch script to start all services simultaneously:
   ```cmd
   .\start-eduvision.bat
   ```
4. Access the platform portal at `http://localhost:5173/`.

## Documentation
- [Setup Guide](docs/SETUP.md): Detailed installation and environment configuration.
- [Architecture Overview](docs/ARCHITECTURE.md): Component diagrams and application integration details.
- [Developer Walkthrough](docs/DEVELOPER_WALKTHROUGH.md): How to work within the codebase and add new integrations.
- [User Walkthrough](docs/USER_WALKTHROUGH.md): The end-to-end journey for Teachers and Students.
- [Testing Guide](docs/TESTING.md): How to run the automated test suites and manual smoke tests.
- [Troubleshooting](docs/TROUBLESHOOTING.md): Solutions for port conflicts, network errors, and database connection issues.
- [GitHub Workflow](docs/GITHUB_WORKFLOW.md): Repository management and safe commit practices.

## Implemented Features
- Centralized Express API using PostgreSQL (Prisma ORM) with strict RBAC (`STUDENT`, `TEACHER`, `ADMIN`).
- Teacher dashboard for assignment tracking.
- Passwordless, avatar-based secure child login workflow.
- Secure "Integration Contract" for transparently launching 3rd party HTML/JS applications.
- Student Story Studio replica seamlessly orchestrating the legacy Python Story Engine and persisting video output to the student's history.
- Global Request Correlation logging (`X-Correlation-Id`) to trace actions end-to-end.

## Known Limitations
- The React/Vite portal UI currently utilizes raw HTML without a styling framework (like Tailwind or Bootstrap), prioritizing functional verification over visual design.
- The `math-blaster-sample` integration is heavily mocked and intentionally disabled ("Coming Soon") to prevent incomplete user experiences.
- Full "Parent Dashboard" cross-referencing capabilities exist in the database but lack dedicated UI views.
