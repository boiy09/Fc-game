# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec - 단일 exe 빌드
# 사용: fc-assistant/ 폴더에서  pyinstaller --clean --noconfirm packaging/fc_assistant.spec
#
# 템플릿/설정/로그는 exe에 포함하지 않는다. 첫 실행 시 exe 옆에
# templates/ config/ logs/ 폴더가 자동 생성되어, 코드 수정 없이
# 이미지 교체만으로 UI 업데이트에 대응한다.

from pathlib import Path

project_root = Path(SPECPATH).parent

a = Analysis(
    [str(project_root / "run_app.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=[],
    hiddenimports=[
        "pyautogui", "pyscreeze", "pytweening", "pygetwindow",
        "pymsgbox", "mouseinfo", "mss", "cv2", "numpy",
        "PIL", "PIL.Image", "PIL.ImageTk",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pytest", "matplotlib", "scipy", "pandas"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="FCManagerAssistant",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,          # GUI 전용 (오류는 logs/crash_*.txt 로 저장)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
