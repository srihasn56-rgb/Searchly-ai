@echo off
echo ============================================
echo  Searchly AI - Python Backend Setup
echo ============================================
echo.

:: Check Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found.
    echo Please install Python 3.10+ from https://python.org
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)

echo Found Python:
python --version
echo.

:: Install dependencies
echo Installing Python dependencies...
echo This may take a few minutes on first run (downloading PyTorch + OpenCLIP)
echo.
python -m pip install --upgrade pip
python -m pip install -r "%~dp0requirements.txt"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies.
    echo Try running this script as Administrator.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Setup complete! You can now run the app.
echo ============================================
pause
