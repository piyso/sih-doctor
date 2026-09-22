@echo off
REM ==============================================================================
REM ALL INDIA INSTITUTE OF AYURVEDA (AIIA) - SOVEREIGN HOSPITAL OS
REM Problem Statement ID: 26047 | Ministry of Ayush & MoHFW
REM Universal 1-Click Startup Launcher for Windows (cmd.exe / PowerShell)
REM ==============================================================================

title AIIA Sovereign Hospital OS - PS ID 26047
cls

echo ==============================================================================
echo        ALL INDIA INSTITUTE OF AYURVEDA (AIIA) - SOVEREIGN HOSPITAL OS
echo          SMART INDIA HACKATHON 2026 - PROBLEM STATEMENT ID: 26047
echo ==============================================================================
echo.

REM 1. Check Node.js
echo [1/4] Checking Node.js Environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed on this PC.
    echo Please install Node.js from https://nodejs.org/ and re-run this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo   [OK] Node.js version: %NODE_VER%

REM 2. Check Dependencies
echo.
echo [2/4] Verifying Package Dependencies...
if not exist "node_modules" (
    echo   Installing root dependencies...
    call npm install
)

if not exist "backend\node_modules" (
    echo   Installing backend dependencies...
    cd backend && call npm install && cd ..
)

if not exist "frontend\node_modules" (
    echo   Installing frontend dependencies...
    cd frontend && call npm install && cd ..
)
echo   [OK] All package dependencies are ready.

REM 3. Display Access URLs
echo.
echo [3/4] Initializing Air-Gapped Hospital OS Terminals...

set WIN_IP=127.0.0.1
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set WIN_IP=%%b
        goto :ip_found
    )
)
:ip_found

echo.
echo ==============================================================================
echo   HOSPITAL OS READY FOR LIVE DEMONSTRATION
echo ==============================================================================
echo.
echo   1. Hospital OS Gateway:       http://localhost:5173/
echo   2. Patient Touch MediKiosk:   http://localhost:5173/?mode=kiosk
echo   3. Doctor Clinical Cockpit:   http://localhost:5173/?mode=doctor
echo   4. Dispensary Pharmacy POS:   http://localhost:5173/?mode=pharmacy
echo   5. Frontline ASHA Field App:  http://localhost:5173/?mode=asha
echo   6. Command ^& Outbreak NOC:    http://localhost:5173/?mode=admin
echo   7. System Defense Matrix:     http://localhost:5173/?mode=matrix
echo.
echo   Mobile Phone / Tablet Link:   http://%WIN_IP%:5173/
echo ==============================================================================
echo   Tip: Open any browser (Chrome, Edge, Brave, Firefox) and navigate to:
echo        http://localhost:5173/
echo   Press Ctrl+C in this window to stop both servers.
echo ==============================================================================
echo.

REM 4. Start concurrent development servers
call npx concurrently --names "BACKEND,FRONTEND" -c "cyan.bold,green.bold" --kill-others "npm run dev --prefix backend" "npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173"

pause
