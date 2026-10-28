@echo off
setlocal EnableDelayedExpansion

echo ========================================================
echo              EduVision Stopper
echo ========================================================
echo.
echo [INFO] Stopping all EduVision processes and freeing ports...

:: 1. Stop processes by window title
taskkill /FI "WINDOWTITLE eq EduVision-API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-Portal*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-StoryStudio*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-StoryEngine*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-StoryReplica*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-Activities*" /T /F >nul 2>nul

:: 2. Terminate any background processes listening on EduVision ports
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ports = @(4000, 5173, 5000, 3000, 3001); foreach ($port in $ports) { try { $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { $pidToKill = $c.OwningProcess; if ($pidToKill -gt 0) { Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue } } } } catch {} }" >nul 2>nul

:: Fallback netstat check
for %%P in (4000 5173 5000 3000 3001) do (
    for /f "tokens=5" %%a in ('netstat -a -n -o 2^>nul ^| findstr ":%%P" ^| findstr "LISTENING"') do (
        if not "%%a"=="" (
            taskkill /PID %%a /F /T >nul 2>nul
        )
    )
)

echo.
echo [INFO] Verifying port status:
set ALL_STOPPED=1

netstat -ano 2>nul | findstr ":4000" | findstr "LISTENING" >nul
if !ERRORLEVEL! EQU 0 (
    echo   - Port 4000 [Express API]: Still Busy
    set ALL_STOPPED=0
) else (
    echo   - Port 4000 [Express API]: Stopped [OK]
)

netstat -ano 2>nul | findstr ":5173" | findstr "LISTENING" >nul
if !ERRORLEVEL! EQU 0 (
    echo   - Port 5173 [React Portal]: Still Busy
    set ALL_STOPPED=0
) else (
    echo   - Port 5173 [React Portal]: Stopped [OK]
)

netstat -ano 2>nul | findstr ":5000" | findstr "LISTENING" >nul
if !ERRORLEVEL! EQU 0 (
    echo   - Port 5000 [Activity Center]: Still Busy
    set ALL_STOPPED=0
) else (
    echo   - Port 5000 [Activity Center]: Stopped [OK]
)

netstat -ano 2>nul | findstr ":3000" | findstr "LISTENING" >nul
if !ERRORLEVEL! EQU 0 (
    echo   - Port 3000 [Story Studio Engine]: Still Busy
    set ALL_STOPPED=0
) else (
    echo   - Port 3000 [Story Studio Engine]: Stopped [OK]
)

netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul
if !ERRORLEVEL! EQU 0 (
    echo   - Port 3001 [Story Studio Replica]: Still Busy
    set ALL_STOPPED=0
) else (
    echo   - Port 3001 [Story Studio Replica]: Stopped [OK]
)

echo.
if !ALL_STOPPED! EQU 1 (
    echo [SUCCESS] All EduVision services have been cleanly stopped and all ports are free!
) else (
    echo [WARNING] Some services could not be stopped automatically. You may need to run this as Administrator.
)
echo ========================================================
pause
