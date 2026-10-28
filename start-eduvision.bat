@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo              EduVision Launcher
echo ========================================================
echo.

:: 1. Pre-flight checks
echo [INFO] Checking required dependencies...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)

echo [INFO] Node and npm verified.

:: Check project files
if not exist "platform\api\server.js" (
    echo [ERROR] Missing platform\api\server.js
    pause
    exit /b 1
)
if not exist "platform\portal\package.json" (
    echo [ERROR] Missing platform\portal\package.json
    pause
    exit /b 1
)
if not exist "eduvision_ui\server.js" (
    echo [ERROR] Missing eduvision_ui\server.js
    pause
    exit /b 1
)
if not exist "platform\activity-center\server.js" (
    echo [ERROR] Missing platform\activity-center\server.js
    pause
    exit /b 1
)
if not exist "platform\api\.env" (
    echo [WARNING] Missing platform\api\.env. The API may fail without database credentials.
)

:: 2. Check PostgreSQL Service
echo.
echo [INFO] Checking PostgreSQL database service...
sc query "postgresql-x64-18" | findstr "RUNNING" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PostgreSQL service is not running. Attempting to start it...
    net start "postgresql-x64-18" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to start PostgreSQL automatically. Administrator permissions may be required.
        echo Please ensure the PostgreSQL service is running before launching EduVision.
        pause
    ) else (
        echo [INFO] PostgreSQL started successfully.
    )
) else (
    echo [INFO] PostgreSQL is running.
)

:: 3. Clear any stale orphaned processes on EduVision ports to guarantee clean startup & logs
echo.
echo [INFO] Ensuring ports (4000, 5173, 5000, 3000, 3001) are ready...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(4000, 5173, 5000, 3000, 3001); foreach ($port in $ports) { try { $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { $pidToKill = $c.OwningProcess; if ($pidToKill -gt 0) { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue } } } } catch {} }" >nul 2>nul

:: 4. Start Express API (Port 4000) - Live Route Logs Console
echo.
echo [INFO] Launching Express API (Port 4000) [Route Logs]...
cd platform\api
start "EduVision-API" cmd /k "title EduVision-API && node server.js"
cd ..\..

:: 5. Start React Portal (Port 5173)
echo [INFO] Launching React Portal (Port 5173)...
cd platform\portal
start "EduVision-Portal" cmd /k "title EduVision-Portal && npm run dev"
cd ..\..

:: 6. Start Story Studio Engine (Port 3000)
echo [INFO] Launching Story Studio Engine (Port 3000)...
cd eduvision_ui
start "EduVision-StoryEngine" cmd /k "title EduVision-StoryEngine && node server.js"
cd ..

:: 7. Start Story Studio Replica (Port 3001)
echo [INFO] Launching Story Studio Replica (Port 3001)...
cd platform\student-story-studio
start "EduVision-StoryReplica" cmd /k "title EduVision-StoryReplica && node server.js"
cd ..\..

:: 8. Start EduVision Activities Center (Port 5000)
echo [INFO] Launching Activities Center (Port 5000)...
cd platform\activity-center
start "EduVision-Activities" cmd /k "title EduVision-Activities && node server.js"
cd ..\..

:: 9. Open Portal in default browser
echo.
echo [INFO] Waiting 5 seconds for services to initialize...
timeout /t 5 /nobreak >nul
echo [INFO] Opening EduVision Portal in browser: http://localhost:5173
start http://localhost:5173

echo.
echo ========================================================
echo   EduVision is now active!
echo   - Express API:           http://localhost:4000
echo   - React Portal:          http://localhost:5173
echo   - Activities Center:     http://localhost:5000
echo   - Story Studio Engine:   http://localhost:3000
echo   - Story Studio Replica:  http://localhost:3001
echo.
echo   To safely stop all services, run: stop-eduvision.bat
echo ========================================================
pause
