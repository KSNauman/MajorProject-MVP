@echo off
echo ========================================================
echo              EduVision Stopper
echo ========================================================
echo.
echo [INFO] Stopping EduVision processes...

taskkill /FI "WINDOWTITLE eq EduVision-API*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-Portal*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EduVision-StoryStudio*" /T /F >nul 2>nul

echo [INFO] All EduVision services started by the launcher have been stopped.
pause
