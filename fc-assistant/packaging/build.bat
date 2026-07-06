@echo off
rem =========================================================
rem  FC 감독모드 보조 도구 - Windows exe 빌드 스크립트
rem  요구사항: Python 3.10+ 이 PATH에 있어야 함 (python --version)
rem  결과물:  fc-assistant\dist\FCManagerAssistant.exe
rem =========================================================
chcp 65001 >nul
cd /d "%~dp0.."

echo [1/4] 가상환경 준비...
if not exist .venv (
    python -m venv .venv || goto :error
)
call .venv\Scripts\activate.bat || goto :error

echo [2/4] 의존성 설치...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt pyinstaller || goto :error

echo [3/4] 셀프테스트...
python -m fc_assistant --selftest || goto :error

echo [4/4] exe 빌드...
pyinstaller --clean --noconfirm packaging\fc_assistant.spec || goto :error

echo.
echo ==== 빌드 완료 ====
echo 실행 파일: %cd%\dist\FCManagerAssistant.exe
echo 처음 실행하면 exe 옆에 templates/ config/ logs/ 폴더가 생성됩니다.
pause
exit /b 0

:error
echo.
echo ==== 빌드 실패 - 위 오류 메시지를 확인하세요 ====
pause
exit /b 1
