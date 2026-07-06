"""실행 기준 경로 관리.

exe(PyInstaller)로 실행하면 exe가 있는 폴더를, 소스로 실행하면 프로젝트
루트를 기준으로 templates/ config/ logs/ 폴더를 사용한다.
템플릿과 설정을 exe 바깥에 두어 코드 수정 없이 이미지 교체가 가능하다.
"""

import sys
from pathlib import Path


def app_base_dir() -> Path:
    if getattr(sys, "frozen", False):  # PyInstaller 실행
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def templates_dir(base: Path | None = None) -> Path:
    return (base or app_base_dir()) / "templates"


def config_dir(base: Path | None = None) -> Path:
    return (base or app_base_dir()) / "config"


def logs_dir(base: Path | None = None) -> Path:
    return (base or app_base_dir()) / "logs"
