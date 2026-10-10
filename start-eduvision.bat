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

echo [INFO] Node and npm found.

:: Check directories
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
if not exist "platform\api\.env" (
    echo [WARNING] Missing platform\api\.env. The API may fail without database credentials.
)

:: 2. Check PostgreSQL Service
echo.
echo [INFO] Checking PostgreSQL service (postgresql-x64-18)...
sc query "postgresql-x64-18" | findstr "RUNNING" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PostgreSQL service is not running. Attempting to start it...
    net start "postgresql-x64-18" >nul 2>nul
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to start PostgreSQL. Administrator permissions are likely required.
        echo Please run this script as Administrator or start the 'postgresql-x64-18' service manually via services.msc.
        pause
        exit /b 1
    )
    echo [INFO] PostgreSQL started successfully.
) else (
    echo [INFO] PostgreSQL is already running.
)

:: 3. Start Express API
echo.
echo [INFO] Checking if API (Port 4000) is running...
netstat -ano | findstr :4000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] API is already running on port 4000. Skipping start.
) else (
    echo [INFO] Starting Express API...
    cd platform\api
    start "EduVision-API" cmd /k "title EduVision-API && node server.js"
    cd ..\..
)

:: 4. Start React Portal
echo.
echo [INFO] Checking if React Portal (Port 5173) is running...
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Portal is already running on port 5173. Skipping start.
) else (
    echo [INFO] Starting React Portal...
    cd platform\portal
    start "EduVision-Portal" cmd /k "title EduVision-Portal && npm run dev"
    cd ..\..
)

:: 5. Start Story Studio Engine (Port 3000)
echo.
echo [INFO] Checking if Story Studio Engine (Port 3000) is running...
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Story Studio Engine is already running on port 3000. Skipping start.
) else (
    echo [INFO] Starting Story Studio Engine...
    cd eduvision_ui
    start "EduVision-StoryEngine" cmd /k "title EduVision-StoryEngine && node server.js"
    cd ..
)

:: 6. Start Story Studio Replica (Port 3001)
echo.
echo [INFO] Checking if Story Studio Replica (Port 3001) is running...
netstat -ano | findstr :3001 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Story Studio Replica is already running on port 3001. Skipping start.
) else (
    echo [INFO] Starting Story Studio Replica...
    cd platform\student-story-studio
    start "EduVision-StoryReplica" cmd /k "title EduVision-StoryReplica && node server.js"
    cd ..\..
)

:: Math Blaster sample app verification
echo.
echo [INFO] Math Blaster sample app does not have a verified setup command or script (no package.json found). Skipping automatic launch.

:: 6. Open Portal
echo.
echo [INFO] Waiting for services to initialize...
timeout /t 5 /nobreak >nul
echo [INFO] Opening EduVision Portal in browser...
start http://localhost:5173

echo.
echo ========================================================
echo EduVision is up and running.
echo To safely stop these services, run stop-eduvision.bat
echo ========================================================
pause
