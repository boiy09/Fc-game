"""사용자 설정 관리 (JSON).

config/user_config.json 에 저장하며, 없는 항목은 기본값으로 채운다.
"""

import json
from pathlib import Path

from .paths import config_dir

CONFIG_FILE_NAME = "user_config.json"

DEFAULTS = {
    # 템플릿
    "template_version": "fc_online_2026_07",
    "resolution_profile": "auto",       # "auto" 또는 "1920x1080" 같은 폴더명
    # 인식
    "confidence": 0.85,                 # 템플릿 매칭 기본 민감도
    "scan_interval_ms": 500,            # 화면 검사 주기
    "unknown_timeout_sec": 5.0,         # 알 수 없는 화면 지속 시 자동 정지
    # 반복/시간 제한 (비정상 장시간 반복 방지)
    "max_loops": 10,
    "max_runtime_min": 90,
    # 오류 처리: "stop"(정지) | "notify"(로그만 남기고 대기)
    "on_error": "stop",
    "save_error_screenshot": True,
    # 로그
    "logging_enabled": True,
    # OCR 보조 (pytesseract 설치 시에만 동작)
    "ocr_enabled": False,
    # 입력
    "post_click_wait_sec": 1.5,         # 클릭 후 화면 전환 대기
    # 게임 창 탐색 키워드 (창 제목에 포함되면 대상)
    "window_title_keywords": ["FC ONLINE", "FC온라인", "FC 온라인"],
    # 단축키 (Windows 전역)
    "hotkey_start": "F9",
    "hotkey_stop": "F10",
}


def _merge(defaults: dict, user: dict) -> dict:
    out = dict(defaults)
    for k, v in user.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def config_path(base: Path | None = None) -> Path:
    return config_dir(base) / CONFIG_FILE_NAME


def load_config(base: Path | None = None) -> dict:
    path = config_path(base)
    if path.exists():
        try:
            user = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(user, dict):
                return _merge(DEFAULTS, user)
        except (json.JSONDecodeError, OSError):
            pass  # 손상된 설정은 기본값으로 대체
    return dict(DEFAULTS)


def save_config(cfg: dict, base: Path | None = None) -> Path:
    path = config_path(base)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path
