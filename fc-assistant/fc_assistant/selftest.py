"""핵심 로직 셀프테스트 (GUI/게임/디스플레이 불필요).

합성 이미지로 다음을 검증한다:
  1. 폴더/manifest 자동 생성 (bootstrap)
  2. 템플릿 저장/로드 + 교체 시 자동 백업
  3. ROI 안 템플릿 매칭 (OpenCV matchTemplate)
  4. 상태 판정: 다중 근거(min_evidence), forbid, 우선순위, UNKNOWN
  5. 해상도 스케일 대응 (1920 프로필 템플릿을 1600 창에서 탐지)
  6. 설정 저장/로드
  7. 전체 모듈 문법 검사 (compileall)

CI(Linux, opencv-python-headless)에서도 그대로 실행된다.
"""

import compileall
import json
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

from .config import DEFAULTS, load_config, save_config
from .detector import Detector
from .imgio import imwrite
from .templates import DEFAULT_VERSION, TemplateManager, ensure_structure

RES_W, RES_H = 1920, 1080


def _patch(seed: int, w: int, h: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.integers(0, 255, size=(h, w), dtype=np.uint8)


def _screen() -> np.ndarray:
    rng = np.random.default_rng(0)
    return rng.integers(0, 24, size=(RES_H, RES_W), dtype=np.uint8)


def _roi_origin(tm: TemplateManager, name: str) -> tuple[int, int]:
    roi = tm.roi_rect(tm.template_info(name).get("roi", "full"))
    return int(roi[0] * RES_W) + 12, int(roi[1] * RES_H) + 12


def _place(screen: np.ndarray, tm: TemplateManager, name: str,
           tmpl: np.ndarray):
    x, y = _roi_origin(tm, name)
    h, w = tmpl.shape
    screen[y:y + h, x:x + w] = tmpl


def run_selftest() -> int:
    # Windows 콘솔(cp1252 등)에서 한글 출력이 깨지거나 예외가 나지 않도록
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (OSError, ValueError):
                pass
    ok = True

    def check(cond: bool, label: str):
        nonlocal ok
        print(("  [OK] " if cond else "  [FAIL] ") + label)
        if not cond:
            ok = False

    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)

        print("1) 폴더/manifest 생성")
        vdir = ensure_structure(base)
        check((vdir / "manifest.json").exists(), "manifest.json 생성")
        check((vdir / "1920x1080").is_dir(), "해상도 폴더 생성")

        tm = TemplateManager(base, DEFAULT_VERSION)
        tm.select_resolution("auto", RES_W, RES_H)
        check(tm.resolution == "1920x1080", f"auto 해상도 선택={tm.resolution}")

        print("2) 템플릿 저장/백업")
        patches = {
            "btn_start": _patch(1, 140, 48),
            "btn_confirm": _patch(2, 150, 46),
            "state_lobby": _patch(3, 180, 70),
            "state_result": _patch(4, 220, 60),
            "state_scoreboard": _patch(5, 200, 50),
            "popup_reward": _patch(6, 160, 90),
        }
        for name, img in patches.items():
            tm.save_template(name, img)
        check(tm.template_path("btn_start").exists(), "btn_start.png 저장")
        tm.save_template("btn_start", _patch(1, 140, 48))  # 재저장 → 백업
        backups = list((tm.version_dir() / "_backup").rglob("*btn_start.png"))
        check(len(backups) == 1, "교체 시 자동 백업")
        missing = tm.missing_templates()
        check("popup_error" in missing and "btn_start" not in missing,
              f"누락 템플릿 감지 ({len(missing)}개)")

        det = Detector(tm, confidence=0.85)

        print("3) LOBBY 인식 (다중 근거)")
        screen = _screen()
        _place(screen, tm, "state_lobby", patches["state_lobby"])
        _place(screen, tm, "btn_start", patches["btn_start"])
        r = det.classify(screen)
        check(r.state_id == "LOBBY", f"상태={r.state_id}")
        m = r.matches.get("btn_start")
        ex, ey = _roi_origin(tm, "btn_start")
        check(m is not None and abs(m.center[0] - (ex + 70)) <= 2
              and abs(m.center[1] - (ey + 24)) <= 2,
              f"버튼 중심 좌표 정확 ({m.center if m else None})")

        print("4) 단일 근거로는 클릭 상태 확정 금지")
        screen = _screen()
        _place(screen, tm, "btn_start", patches["btn_start"])  # 로비 근거 1개뿐
        r = det.classify(screen)
        check(r.state_id is None, f"근거 부족 → UNKNOWN (={r.state_id})")

        print("5) RESULT / forbid / 우선순위")
        screen = _screen()
        _place(screen, tm, "state_result", patches["state_result"])
        _place(screen, tm, "btn_confirm", patches["btn_confirm"])
        r = det.classify(screen)
        check(r.state_id == "RESULT", f"결과 화면 인식 (={r.state_id})")
        # 경기 UI가 함께 보이면 RESULT는 무효(forbid) → IN_GAME으로 판정
        _place(screen, tm, "state_scoreboard", patches["state_scoreboard"])
        r = det.classify(screen)
        check(r.state_id == "IN_GAME", f"forbid 동작 (={r.state_id})")

        print("6) REWARD (팝업 프레임+버튼 조합)")
        screen = _screen()
        _place(screen, tm, "popup_reward", patches["popup_reward"])
        _place(screen, tm, "btn_confirm", patches["btn_confirm"])
        r = det.classify(screen)
        check(r.state_id == "REWARD", f"보상 팝업 인식 (={r.state_id})")

        print("7) 빈 화면 → UNKNOWN")
        r = det.classify(_screen())
        check(r.state_id is None, f"상태={r.state_id}")

        print("8) 해상도 스케일 (1920 템플릿 → 1600 창)")
        scale = 1600 / 1920
        small = cv2.resize(_screen(), (1600, 900),
                           interpolation=cv2.INTER_AREA)
        for name in ("state_lobby", "btn_start"):
            tmpl = patches[name]
            sc = cv2.resize(tmpl, (int(tmpl.shape[1] * scale),
                                   int(tmpl.shape[0] * scale)),
                            interpolation=cv2.INTER_AREA)
            x, y = _roi_origin(tm, name)
            sx, sy = int(x * scale), int(y * scale)
            small[sy:sy + sc.shape[0], sx:sx + sc.shape[1]] = sc
        det2 = Detector(tm, confidence=0.70)  # 리샘플 손실 감안
        r = det2.classify(small)
        check(r.state_id == "LOBBY", f"스케일 매칭 (={r.state_id})")

        print("9) 설정 저장/로드")
        cfg = dict(DEFAULTS)
        cfg["max_loops"] = 7
        save_config(cfg, base)
        loaded = load_config(base)
        check(loaded["max_loops"] == 7 and
              loaded["confidence"] == DEFAULTS["confidence"], "설정 왕복")

        print("10) manifest 파일 우선 적용")
        mpath = tm.version_dir() / "manifest.json"
        data = json.loads(mpath.read_text(encoding="utf-8"))
        data["default_threshold"] = 0.5
        mpath.write_text(json.dumps(data, ensure_ascii=False),
                         encoding="utf-8")
        tm2 = TemplateManager(base, DEFAULT_VERSION)
        check(tm2.default_threshold() == 0.5, "수정된 manifest 로드")

        print("11) imgio 한글 경로")
        kpath = base / "한글 폴더" / "테스트.png"
        check(imwrite(kpath, patches["btn_start"]) and kpath.exists(),
              "한글 경로 저장")

    print("12) 전체 모듈 문법 검사")
    pkg_dir = Path(__file__).resolve().parent
    check(compileall.compile_dir(str(pkg_dir), quiet=1, force=True),
          "compileall")

    print("\nSELFTEST " + ("OK" if ok else "FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(run_selftest())
