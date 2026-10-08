@echo off
REM Start this Windows PC as a locked patient kiosk (or waiting-room display).
REM   start-kiosk-browser.bat https://hospital.local            (patient kiosk)
REM   start-kiosk-browser.bat https://hospital.local display    (waiting-room TV)
REM Enrol the device first: Administration > Kiosks & screens > "Enrol this device".
set URL=%1
set MODE=%2
if "%URL%"=="" (echo Usage: start-kiosk-browser.bat ^<server-url^> [kiosk^|display] & exit /b 1)
if "%MODE%"=="" set MODE=kiosk
set TARGET=%URL%/?mode=%MODE%
if "%MODE%"=="kiosk" set TARGET=%TARGET%^&lock=1
set CHROME="%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
start "" %CHROME% --kiosk "%TARGET%" --user-data-dir="%LOCALAPPDATA%\HospitalOSKiosk" --no-first-run --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 --kiosk-printing --autoplay-policy=no-user-gesture-required
