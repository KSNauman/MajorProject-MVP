@echo off
title EduVision Startup

echo [1/2] Starting AI Microservice (GPU/Flask)...
start "EduVision AI Backend" cmd /k "cd .. && python story_engine\ai_server.py"

echo [2/2] Starting Node.js UI Server...
start "EduVision UI" cmd /k "node server.js"

echo Both servers started! You can now open http://localhost:3000
pause
