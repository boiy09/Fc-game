@echo off
chcp 65001 >nul
REM ============================================
REM  화면 자동화 런처 - Windows exe 빌드 스크립트
REM  (Python 설치되어 있어야 함: https://python.org)
REM ============================================
setlocal
cd /d "%~dp0"

echo [1/3] 가상환경 생성...
python -m venv .venv || goto :err
call .venv\Scripts\activate.bat

echo [2/3] 의존성 설치...
python -m pip install --upgrade pip
pip install -r requirements.txt pyinstaller || goto :err

echo [3/3] exe 빌드...
pyinstaller --onefile --name screen-automation app.py || goto :err

echo.
echo ============================================
echo  완료!  dist\screen-automation.exe 를 실행하세요.
echo ============================================
pause
exit /b 0

:err
echo.
echo [오류] 빌드 실패. 위 메시지를 확인하세요 (Python 설치 여부 등).
pause
exit /b 1
