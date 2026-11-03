@echo off
cd /d "%~dp0"
echo Installing Python backend dependencies...
py -m pip install -r backend\requirements.txt
if errorlevel 1 exit /b 1
start "FlexPass FastAPI" cmd /k "cd /d %~dp0 && py run.py"
cd frontend
if not exist node_modules (
  echo Installing React, TypeScript and Vite dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
echo Starting React + Vite frontend at http://127.0.0.1:5173
start "FlexPass React Vite" cmd /k "cd /d %~dp0frontend && npm run dev"
echo Open http://127.0.0.1:5173/services?maxCredits=5
pause
