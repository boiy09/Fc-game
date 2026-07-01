@echo off
REM ============================================================
REM  image_automation - Windows .exe builder (double-click me)
REM  Produces: dist\image_automation.exe
REM  Requires: Python 3.9+ on PATH, internet connection.
REM ============================================================
setlocal
cd /d "%~dp0"

echo [1/3] Installing required packages...
python -m pip install --upgrade pip
python -m pip install numpy opencv-python-headless mss pyautogui pyinstaller
if errorlevel 1 goto :error

echo.
echo [2/3] Building exe (this can take a few minutes)...
python -m PyInstaller --onefile --name image_automation --clean ^
  --collect-submodules pyautogui ^
  --collect-submodules pyscreeze ^
  image_automation.py
if errorlevel 1 goto :error

echo.
echo [3/3] Done!
echo   Created: %cd%\dist\image_automation.exe
echo   Run it: double-click the exe for the interactive menu,
echo           or from cmd:  image_automation.exe click -t button.png
goto :end

:error
echo.
echo [ERROR] Build failed. Check the messages above.
echo   - Is Python installed and on PATH?   (run: python --version)
echo   - Is your internet connection working?

:end
echo.
pause
endlocal
