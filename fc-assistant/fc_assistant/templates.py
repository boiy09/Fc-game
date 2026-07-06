"""템플릿 관리자 (Template Manager).

폴더 구조:
    templates/
      fc_online_2026_07/            <- 템플릿 버전 (UI 기준 날짜)
        manifest.json               <- 상태/ROI/템플릿 정의
        1920x1080/                  <- 해상도 프로필
          btn_start.png ...
        2560x1440/
        _backup/20260706_120000/    <- 교체 전 자동 백업

코드 수정 없이 manifest.json과 PNG 교체만으로 UI 업데이트에 대응한다.
"""

import json
import re
import shutil
import time
from pathlib import Path

import cv2
import numpy as np

from . import states as st
from .imgio import imread, imwrite
from .paths import templates_dir

DEFAULT_VERSION = "fc_online_2026_07"
MANIFEST_NAME = "manifest.json"
BACKUP_DIR_NAME = "_backup"
DEFAULT_RESOLUTIONS = ["1920x1080", "2560x1440"]

# 기본 manifest. 첫 실행 시 파일로 생성되며, 이후에는 파일 내용이 우선한다.
# ROI는 게임 창 클라이언트 영역 대비 비율 [x, y, w, h].
DEFAULT_MANIFEST = {
    "version": DEFAULT_VERSION,
    "comment": "UI 업데이트 시 이 파일과 PNG 템플릿만 교체하면 됩니다. 코드 수정 불필요.",
    "default_threshold": 0.85,
    "rois": {
        "full": [0.0, 0.0, 1.0, 1.0],
        "bottom_center": [0.28, 0.68, 0.44, 0.32],
        "bottom_right": [0.58, 0.66, 0.42, 0.34],
        "top_center": [0.26, 0.0, 0.48, 0.20],
        "popup_center": [0.18, 0.14, 0.64, 0.70],
        "left_menu": [0.0, 0.08, 0.26, 0.84],
    },
    "templates": {
        "btn_start": {"roi": "bottom_right", "desc": "감독모드 경기 시작 버튼"},
        "btn_confirm": {"roi": "bottom_center", "desc": "확인/다음 버튼"},
        "btn_close": {"roi": "popup_center", "desc": "팝업 닫기 버튼"},
        "state_lobby": {"roi": "left_menu", "desc": "감독모드 로비 고유 UI"},
        "state_matching": {"roi": "full", "desc": "매칭/로딩 화면 고유 UI"},
        "state_scoreboard": {"roi": "top_center", "desc": "경기 중 스코어보드"},
        "state_match_time": {"roi": "top_center", "desc": "경기 중 시간 표시"},
        "state_result": {"roi": "top_center", "desc": "경기 결과 화면 타이틀"},
        "popup_reward": {"roi": "popup_center", "desc": "보상 팝업 프레임"},
        "popup_error": {"roi": "popup_center", "desc": "오류/점검/네트워크 팝업 프레임"},
    },
    # 우선순위 낮은 숫자 먼저 검사. 팝업/오류를 일반 상태보다 먼저 본다.
    # min_evidence: 상태 확정에 필요한 최소 일치 개수 (클릭 상태는 2개 이상).
    # forbid: 하나라도 일치하면 해당 상태 아님 (예: 결과 화면인데 경기 UI가 보이면 무효).
    "states": [
        {
            "id": st.ERROR, "name": "오류 팝업", "priority": 10,
            "evidence": ["popup_error"], "min_evidence": 1,
            "action": {"type": "error"},
        },
        {
            "id": st.REWARD, "name": "보상/알림 팝업", "priority": 20,
            "evidence": ["popup_reward", "btn_confirm", "btn_close"],
            "min_evidence": 2,
            "action": {"type": "click", "targets": ["btn_confirm", "btn_close"],
                       "confirm_scans": 2},
        },
        {
            "id": st.RESULT, "name": "경기 종료(결과)", "priority": 30,
            "evidence": ["state_result", "btn_confirm"], "min_evidence": 2,
            "forbid": ["state_scoreboard"],
            "action": {"type": "click", "targets": ["btn_confirm"],
                       "confirm_scans": 2, "count_loop": True},
        },
        {
            "id": st.IN_GAME, "name": "경기 진행 중", "priority": 40,
            "evidence": ["state_scoreboard", "state_match_time"],
            "min_evidence": 1,
            "action": {"type": "wait"},
        },
        {
            "id": st.MATCHING, "name": "매칭/로딩 중", "priority": 50,
            "evidence": ["state_matching"], "min_evidence": 1,
            "action": {"type": "wait"},
        },
        {
            "id": st.LOBBY, "name": "감독모드 로비", "priority": 60,
            "evidence": ["state_lobby", "btn_start"], "min_evidence": 2,
            "action": {"type": "click", "targets": ["btn_start"],
                       "confirm_scans": 2},
        },
    ],
}

_RES_RE = re.compile(r"^(\d{3,5})x(\d{3,5})$")

RESOLUTION_README = """이 폴더에 이 해상도로 캡처한 템플릿 PNG를 넣으세요.

필요한 파일 이름은 manifest.json 의 templates 항목과 같습니다.
  btn_start.png, btn_confirm.png, btn_close.png,
  state_lobby.png, state_matching.png, state_scoreboard.png,
  state_match_time.png, state_result.png,
  popup_reward.png, popup_error.png

프로그램의 [템플릿 관리] 탭에서 게임 화면을 캡처해 영역을 드래그하면
자동으로 올바른 위치에 저장됩니다.
"""


def ensure_structure(base: Path | None = None,
                     version: str = DEFAULT_VERSION) -> Path:
    """templates/버전/해상도 폴더와 manifest.json을 없을 때만 생성한다."""
    root = templates_dir(base)
    vdir = root / version
    vdir.mkdir(parents=True, exist_ok=True)
    manifest_path = vdir / MANIFEST_NAME
    if not manifest_path.exists():
        manifest_path.write_text(
            json.dumps(DEFAULT_MANIFEST, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    for res in DEFAULT_RESOLUTIONS:
        rdir = vdir / res
        rdir.mkdir(parents=True, exist_ok=True)
        readme = rdir / "README.txt"
        if not readme.exists():
            readme.write_text(RESOLUTION_README, encoding="utf-8")
    return vdir


class TemplateManager:
    def __init__(self, base: Path | None = None,
                 version: str | None = None):
        self.root = templates_dir(base)
        self.version = version or self._pick_version()
        self.resolution: str | None = None
        self.manifest: dict = {}
        self._cache: dict[str, np.ndarray | None] = {}
        self._scaled: dict[tuple[str, float], np.ndarray] = {}
        self.load_manifest()

    # ---------- 버전/해상도 ----------
    def _pick_version(self) -> str:
        for v in self.list_versions():
            return v
        return DEFAULT_VERSION

    def list_versions(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted(
            d.name for d in self.root.iterdir()
            if d.is_dir() and (d / MANIFEST_NAME).exists()
        )

    def version_dir(self) -> Path:
        return self.root / self.version

    def list_resolutions(self) -> list[str]:
        vdir = self.version_dir()
        if not vdir.exists():
            return []
        return sorted(
            d.name for d in vdir.iterdir()
            if d.is_dir() and _RES_RE.match(d.name)
        )

    def select_resolution(self, profile: str, win_w: int = 0,
                          win_h: int = 0) -> str:
        """해상도 프로필 결정. auto면 창 크기와 같은 폴더 → 가장 근접한 폴더."""
        if profile != "auto":
            self._set_resolution(profile)
            return profile
        exact = f"{win_w}x{win_h}"
        avail = self.list_resolutions()
        if exact in avail:
            self._set_resolution(exact)
            return exact
        # 템플릿이 실제로 존재하는 폴더 중 가로 크기가 가장 가까운 것
        candidates = [r for r in avail if any((self.version_dir() / r).glob("*.png"))]
        if candidates and win_w:
            best = min(candidates,
                       key=lambda r: abs(int(r.split("x")[0]) - win_w))
            self._set_resolution(best)
            return best
        self._set_resolution(exact if win_w else (avail[0] if avail else "1920x1080"))
        return self.resolution or exact

    def _set_resolution(self, res: str):
        if res != self.resolution:
            self.resolution = res
            self._cache.clear()
            self._scaled.clear()

    def profile_size(self) -> tuple[int, int]:
        m = _RES_RE.match(self.resolution or "")
        if m:
            return int(m.group(1)), int(m.group(2))
        return (1920, 1080)

    def resolution_dir(self) -> Path:
        return self.version_dir() / (self.resolution or "1920x1080")

    # ---------- manifest ----------
    def load_manifest(self):
        path = self.version_dir() / MANIFEST_NAME
        if path.exists():
            try:
                self.manifest = json.loads(path.read_text(encoding="utf-8"))
                return
            except (json.JSONDecodeError, OSError):
                pass
        self.manifest = json.loads(json.dumps(DEFAULT_MANIFEST))

    def template_names(self) -> list[str]:
        return list(self.manifest.get("templates", {}).keys())

    def template_info(self, name: str) -> dict:
        return self.manifest.get("templates", {}).get(name, {})

    def roi_rect(self, roi_name: str) -> list[float]:
        return self.manifest.get("rois", {}).get(roi_name, [0.0, 0.0, 1.0, 1.0])

    def state_defs(self) -> list[dict]:
        defs = list(self.manifest.get("states", []))
        defs.sort(key=lambda s: s.get("priority", 999))
        return defs

    def default_threshold(self) -> float:
        return float(self.manifest.get("default_threshold", 0.85))

    # ---------- 템플릿 이미지 ----------
    def template_path(self, name: str) -> Path:
        return self.resolution_dir() / f"{name}.png"

    def get(self, name: str) -> np.ndarray | None:
        """그레이스케일 템플릿 반환. 파일이 없으면 None."""
        if name not in self._cache:
            path = self.template_path(name)
            self._cache[name] = imread(path, grayscale=True) if path.exists() else None
        return self._cache[name]

    def get_scaled(self, name: str, scale: float) -> np.ndarray | None:
        """창 크기와 프로필 해상도가 다를 때 배율 적용한 템플릿 반환."""
        base = self.get(name)
        if base is None:
            return None
        if abs(scale - 1.0) < 0.02:
            return base
        key = (name, round(scale, 3))
        if key not in self._scaled:
            h, w = base.shape[:2]
            nw, nh = max(4, int(w * scale)), max(4, int(h * scale))
            interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
            self._scaled[key] = cv2.resize(base, (nw, nh), interpolation=interp)
        return self._scaled[key]

    def missing_templates(self) -> list[str]:
        return [n for n in self.template_names()
                if not self.template_path(n).exists()]

    def save_template(self, name: str, img: np.ndarray,
                      resolution: str | None = None,
                      backup: bool = True) -> Path:
        """템플릿 저장. 기존 파일은 _backup/시각/ 아래로 보관 후 교체."""
        res = resolution or self.resolution or "1920x1080"
        dest = self.version_dir() / res / f"{name}.png"
        if backup and dest.exists():
            bdir = (self.version_dir() / BACKUP_DIR_NAME /
                    time.strftime("%Y%m%d_%H%M%S"))
            bdir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dest, bdir / f"{res}__{name}.png")
        if not imwrite(dest, img):
            raise OSError(f"템플릿 저장 실패: {dest}")
        self._cache.pop(name, None)
        self._scaled = {k: v for k, v in self._scaled.items() if k[0] != name}
        return dest

    def reload(self):
        self._cache.clear()
        self._scaled.clear()
        self.load_manifest()
