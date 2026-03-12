@echo off
echo ============================================
echo  Searchly AI - Build Python Backend .exe
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

:: Upgrade pip first
echo Upgrading pip...
python -m pip install --upgrade pip

:: Install ALL required packages into the CURRENT Python environment
echo.
echo Installing Flask and all dependencies into current Python environment...
echo (This ensures PyInstaller can find and bundle them correctly)
echo.
python -m pip install flask>=3.0.0 flask-cors>=4.0.0
python -m pip install open-clip-torch>=2.24.0
python -m pip install torch>=2.0.0 torchvision>=0.15.0
python -m pip install Pillow>=10.0.0 numpy>=1.24.0

:: Verify Flask is actually importable before building
echo.
echo Verifying Flask is installed correctly...
python -c "import flask; print('Flask OK:', flask.__version__)"
if errorlevel 1 (
    echo ERROR: Flask failed to import even after install. 
    echo Try running this script as Administrator.
    pause
    exit /b 1
)

python -c "import flask_cors; print('Flask-CORS OK')"
if errorlevel 1 (
    echo ERROR: flask_cors failed to import.
    pause
    exit /b 1
)

echo All dependencies verified!
echo.

:: Install PyInstaller
echo Installing PyInstaller...
python -m pip install pyinstaller
if errorlevel 1 (
    echo ERROR: Failed to install PyInstaller.
    pause
    exit /b 1
)

:: Clean previous build artifacts to avoid stale cache issues
echo.
echo Cleaning previous build artifacts...
if exist "dist" rmdir /S /Q dist
if exist "build" rmdir /S /Q build

:: Run PyInstaller with the fixed spec
echo.
echo Building searchly_server.exe...
echo This will take 5-10 minutes...
echo.
python -m PyInstaller searchly_server.spec --noconfirm --clean

if errorlevel 1 (
    echo.
    echo ERROR: Build failed. Check the output above.
    pause
    exit /b 1
)

:: Verify the exe was actually created
if not exist "dist\searchly_server\searchly_server.exe" (
    echo ERROR: searchly_server.exe was not created.
    echo Check PyInstaller output above for errors.
    pause
    exit /b 1
)

echo.
echo searchly_server.exe created successfully!

:: Copy the output folder to where Electron expects it
echo.
echo Copying output to ..\resources\python_server\ ...
if not exist "..\resources" mkdir "..\resources"
if exist "..\resources\python_server" rmdir /S /Q "..\resources\python_server"
xcopy /E /I /Y "dist\searchly_server" "..\resources\python_server"

echo.
echo ============================================
echo  Done! searchly_server.exe is ready.
echo  Now run: npm run build:win
echo ============================================
pause
