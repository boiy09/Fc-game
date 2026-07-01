@echo off
chcp 65001 >nul
REM ============================================
REM  화면 자동화 런처 - 빌드 없이 바로 실행 (Windows)
REM  최초 1회만 의존성을 설치하고, 이후엔 바로 실행됩니다.
REM ============================================
setlocal
cd /d "%~dp0"

if not exist ".venv" (
  echo 최초 실행: 가상환경 및 의존성 설치 중...
  python -m venv .venv || goto :err
  call .venv\Scripts\activate.bat
  python -m pip install --upgrade pip
  pip install -r requirements.txt || goto :err
) else (
  call .venv\Scripts\activate.bat
)

python app.py
pause
exit /b 0

:err
echo.
echo [오류] 실행 준비 실패. Python 이 설치되어 있는지 확인하세요.
pause
exit /b 1
