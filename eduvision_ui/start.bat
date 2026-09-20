@echo off
title EduVision UI

echo Starting Node.js UI Server...
start "EduVision UI" cmd /k "node server.js"

echo Server started! You can now open http://localhost:3000
pause
