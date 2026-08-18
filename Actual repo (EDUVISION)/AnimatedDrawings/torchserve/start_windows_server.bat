@echo off
echo ========================================================
echo   Native Windows TorchServe Setup (Animated Drawings)
echo ========================================================

cd /d "%~dp0"

IF NOT EXIST "model-store" (
    mkdir model-store
)

echo [*] Checking for drawn_humanoid_detector.mar...
IF NOT EXIST "model-store\drawn_humanoid_detector.mar" (
    echo [*] Downloading drawn_humanoid_detector.mar...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_detector.mar' -OutFile 'model-store\drawn_humanoid_detector.mar'"
)

echo [*] Checking for drawn_humanoid_pose_estimator.mar...
IF NOT EXIST "model-store\drawn_humanoid_pose_estimator.mar" (
    echo [*] Downloading drawn_humanoid_pose_estimator.mar...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar' -OutFile 'model-store\drawn_humanoid_pose_estimator.mar'"
)

echo [*] Installing required Python packages...
pip install -q torchserve mmdet==2.27.0 mmpose==0.29.0

echo [*] Starting TorchServe natively...
echo [*] IMPORTANT: Keep this window open. The web app will connect to localhost:8080.
torchserve --start --ts-config config.windows.properties --foreground
