@echo off
REM PixelPulse - Upload Anime to Oracle Cloud (Windows)
REM This script uploads anime videos from local hard drive to Oracle Cloud

REM Configuration
set LOCAL_ANIME_PATH=E:\PixelPulse
set ORACLE_USER=ubuntu
set ORACLE_IP=
set REMOTE_ANIME_PATH=/home/ubuntu/anime

echo PixelPulse - Upload Anime to Oracle Cloud
echo ============================================
echo.

REM Check if Oracle IP is set
if "%ORACLE_IP%"=="" (
    echo Error: ORACLE_IP not set
    echo Please edit this script and set your Oracle Cloud public IP
    pause
    exit /b 1
)

REM Check if local anime path exists
if not exist "%LOCAL_ANIME_PATH%" (
    echo Error: Local anime path not found: %LOCAL_ANIME_PATH%
    pause
    exit /b 1
)

echo Configuration:
echo Local Path: %LOCAL_ANIME_PATH%
echo Remote Server: %ORACLE_USER%@%ORACLE_IP%
echo Remote Path: %REMOTE_ANIME_PATH%
echo.

REM Check if rsync is installed
where rsync >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: rsync not found
    echo Please install rsync for Windows:
    echo 1. Download from https://cwrsync.github.io/
    echo 2. Or use Git Bash which includes rsync
    pause
    exit /b 1
)

REM Create remote directory
echo Creating remote directory...
ssh %ORACLE_USER%@%ORACLE_IP% "mkdir -p %REMOTE_ANIME_PATH%"

REM Upload anime files
echo Uploading anime files...
echo This may take a while depending on your internet speed and file sizes...
echo.

rsync -avz --progress ^
    --exclude "*.db" ^
    --exclude "node_modules" ^
    --exclude ".git" ^
    "%LOCAL_ANIME_PATH%/" ^
    %ORACLE_USER%@%ORACLE_IP%:%REMOTE_ANIME_PATH%/

echo.
echo Upload complete!
echo Anime files are now available on Oracle Cloud at: %REMOTE_ANIME_PATH%
pause
