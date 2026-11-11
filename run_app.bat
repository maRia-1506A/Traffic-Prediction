@echo off
title Dhaka Traffic Prediction System Launcher
echo ========================================================
echo   Launching Dhaka Traffic Prediction Server and Frontend
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking dependencies...
if not exist "node_modules" (
    echo Installing root dependencies...
    call npm install
)

echo.
echo [2/2] Starting Node.js API Backend (Port 5000) ^& Vite Frontend (Port 3000)...
echo Press Ctrl+C in this terminal to stop both servers.
echo.

call npm run dev
pause

