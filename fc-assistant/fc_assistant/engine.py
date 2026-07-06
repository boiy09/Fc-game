"""자동화 엔진 - 메인 루프.

[창 확인] → [캡처] → [상태 인식] → [상태별 판단] → [입력] → [로그] 순환.

안전 규칙:
- 게임 창이 포그라운드가 아니면 어떤 입력도 하지 않는다.
- 알 수 없는 화면이 unknown_timeout_sec 이상 지속되면 자동 정지 + 스크린샷.
- 클릭 상태는 confirm_scans회 연속 같은 상태로 인식된 뒤,
  클릭 직전에 화면을 다시 캡처해 버튼을 재확인하고 나서만 클릭한다.
- 반복 횟수(max_loops)와 총 실행 시간(max_runtime_min)을 넘으면 정지한다.
"""

import threading
import time
from pathlib import Path

from . import states as st
from .actions import ActionController
from .capture import CaptureManager
from .detector import Detector, StateResult, to_gray
from .logger import RunLogger
from .templates import TemplateManager
from .window import WindowManager

EMIT_LOG = "log"
EMIT_STATE = "state"
EMIT_COUNTERS = "counters"
EMIT_STOPPED = "stopped"


class AutomationEngine(threading.Thread):
    def __init__(self, config: dict, base: Path | None = None,
                 emit=lambda event: None):
        super().__init__(daemon=True, name="AutomationEngine")
        self.cfg = config
        self.base = base
        self.emit = emit
        self._stop_req = threading.Event()
        self._pause = threading.Event()
        # 카운터
        self.loops_done = 0
        self.clicks = 0
        self.errors = 0

    # ---------- 외부 제어 ----------
    def request_stop(self, reason: str = "사용자 정지"):
        self._stop_reason = reason
        self._stop_req.set()

    def toggle_pause(self) -> bool:
        if self._pause.is_set():
            self._pause.clear()
        else:
            self._pause.set()
        return self._pause.is_set()

    @property
    def paused(self) -> bool:
        return self._pause.is_set()

    # ---------- 내부 헬퍼 ----------
    def _log(self, state: str, action: str, detail: str = "",
             score: float | None = None):
        line = self.logger.event(state, action, detail, score)
        self.emit({"type": EMIT_LOG, "line": line})

    def _set_state(self, state_id: str, detail: str = ""):
        self.emit({"type": EMIT_STATE, "state": state_id,
                   "name": st.state_name(state_id), "detail": detail})

    def _counters(self):
        self.emit({"type": EMIT_COUNTERS, "loops": self.loops_done,
                   "max": int(self.cfg["max_loops"]),
                   "clicks": self.clicks, "errors": self.errors})

    def _sleep(self, sec: float) -> bool:
        """정지 요청을 확인하며 대기. 정지 요청 시 False."""
        return not self._stop_req.wait(sec)

    # ---------- 메인 ----------
    def run(self):
        self._stop_reason = "정상 종료"
        self.logger = RunLogger(self.base,
                                enabled=bool(self.cfg["logging_enabled"]))
        try:
            self._loop()
        except Exception as e:  # 예기치 못한 오류도 안전 정지로 처리
            import traceback
            self._stop_reason = f"내부 오류: {e}"
            self.logger.event(st.STOPPED, "내부 오류",
                              traceback.format_exc(limit=3))
        finally:
            self.logger.event(st.STOPPED, "엔진 종료", self._stop_reason)
            self.logger.close()
            self.emit({"type": EMIT_STOPPED, "reason": self._stop_reason})

    def _loop(self):
        cfg = self.cfg
        tm = TemplateManager(self.base, cfg["template_version"])
        wm = WindowManager(cfg["window_title_keywords"])
        cap = CaptureManager()
        detector = Detector(tm, confidence=float(cfg["confidence"]))
        self._actions = ActionController()

        missing = None
        interval = max(0.1, float(cfg["scan_interval_ms"]) / 1000.0)
        unknown_since: float | None = None
        last_state_id: str | None = None
        same_count = 0
        # 반복 카운트 이중 계산 방지: 상태가 한 번 바뀌어야 다시 셀 수 있음
        self._armed_count = True
        started_at = time.monotonic()
        deadline = started_at + float(cfg["max_runtime_min"]) * 60
        notified_no_window = False
        notified_inactive = False

        self._log(st.IDLE, "시작",
                  f"버전={tm.version}, 민감도={cfg['confidence']}, "
                  f"반복 제한={cfg['max_loops']}회, "
                  f"시간 제한={cfg['max_runtime_min']}분")
        self._counters()

        while not self._stop_req.is_set():
            if time.monotonic() > deadline:
                self._stop_reason = "최대 실행 시간 도달"
                break

            if self._pause.is_set():
                self._set_state(st.IDLE, "일시정지")
                if not self._sleep(0.3):
                    break
                continue

            # 1) 창 확인
            win = wm.find()
            if win is None:
                self._set_state(st.DETECT_WINDOW)
                if not notified_no_window:
                    self._log(st.DETECT_WINDOW, "게임 창 없음",
                              "FC온라인 창을 찾는 중 (Windows 전용)")
                    notified_no_window = True
                unknown_since = None
                if not self._sleep(1.0):
                    break
                continue
            notified_no_window = False

            # 해상도 프로필 결정 (auto면 창 크기 기준)
            res = tm.select_resolution(cfg["resolution_profile"], win.w, win.h)
            if missing is None:
                missing = tm.missing_templates()
                if missing:
                    self._log(st.IDLE, "템플릿 누락 경고",
                              f"{res} 폴더에 없음: {', '.join(missing)} "
                              "(해당 상태는 인식 불가)")

            # 2) 창 비활성 시 입력 금지 대기
            if not wm.is_foreground():
                self._set_state(st.WINDOW_INACTIVE)
                if not notified_inactive:
                    self._log(st.WINDOW_INACTIVE, "입력 금지",
                              "게임 창이 활성 상태가 아님")
                    notified_inactive = True
                unknown_since = None
                same_count = 0
                if not self._sleep(0.5):
                    break
                continue
            notified_inactive = False

            # 3) 캡처 + 상태 인식
            frame = cap.grab(win.region())
            gray = to_gray(frame)
            result: StateResult = detector.classify(gray)

            if result.state is None:
                self._set_state(st.UNKNOWN, result.summary())
                now = time.monotonic()
                if unknown_since is None:
                    unknown_since = now
                elif now - unknown_since >= float(cfg["unknown_timeout_sec"]):
                    path = self.logger.screenshot(frame, "unknown")
                    self._log(st.UNKNOWN, "안전 정지",
                              f"{cfg['unknown_timeout_sec']}초 이상 상태 판단 실패"
                              + (f", 스크린샷={path.name}" if path else ""))
                    self._stop_reason = "알 수 없는 화면 - 안전 정지"
                    break
                same_count = 0
                last_state_id = None
                if not self._sleep(interval):
                    break
                continue

            unknown_since = None
            sid = result.state_id
            self._set_state(sid, result.summary())
            if sid == last_state_id:
                same_count += 1
            else:
                same_count = 1
                last_state_id = sid
                self._armed_count = True
                self._log(sid, "상태 인식", result.summary())

            # 4) 상태별 동작
            action = result.state.get("action", {"type": "wait"})
            atype = action.get("type", "wait")

            if atype == "error":
                self.errors += 1
                self._counters()
                detail = "오류/점검 팝업 감지"
                if bool(self.cfg.get("ocr_enabled")):
                    from . import ocr
                    text = ocr.read_text(frame)
                    if text:
                        detail += f" | OCR: {text}"
                if bool(cfg["save_error_screenshot"]):
                    path = self.logger.screenshot(frame, "error")
                    if path:
                        detail += f" | 스크린샷={path.name}"
                self._log(st.ERROR, "오류 감지", detail)
                if cfg["on_error"] == "stop":
                    self._stop_reason = "오류 화면 감지 - 안전 정지"
                    break
                # notify: 기록만 하고 대기 (자동 클릭하지 않음)
                if not self._sleep(2.0):
                    break
                continue

            if atype == "click" and same_count >= int(action.get("confirm_scans", 2)):
                clicked = self._do_click(win, wm, cap, detector, result, action)
                if clicked:
                    same_count = 0
                    if action.get("count_loop") and self._armed_count:
                        self._armed_count = False
                        self.loops_done += 1
                        self._counters()
                        self._log(sid, "반복 완료",
                                  f"{self.loops_done}/{cfg['max_loops']}회")
                        if self.loops_done >= int(cfg["max_loops"]):
                            self._stop_reason = "설정한 반복 횟수 도달"
                            break
                    if not self._sleep(float(cfg["post_click_wait_sec"])):
                        break
                    continue

            if not self._sleep(interval):
                break

    def _do_click(self, win, wm: WindowManager, cap: CaptureManager,
                  detector: Detector, result: StateResult,
                  action: dict) -> bool:
        """클릭 직전 재확인 후 버튼 중앙 클릭. 성공 시 True."""
        target = next((t for t in action.get("targets", [])
                       if t in result.matches), None)
        if target is None:
            return False
        # 재확인: 화면을 다시 캡처해 같은 버튼이 여전히 있는지 검사
        frame2 = cap.grab(win.region())
        match2, score2 = detector.find(to_gray(frame2), target)
        if match2 is None:
            self._log(result.state_id, "클릭 취소",
                      f"{target} 재확인 실패", score2 if score2 >= 0 else None)
            return False
        if not wm.is_foreground():
            self._log(result.state_id, "클릭 취소", "게임 창 비활성")
            return False
        sx = win.x + match2.center[0]
        sy = win.y + match2.center[1]
        try:
            self._actions.click(sx, sy)
        except Exception as e:
            # PyAutoGUI FAILSAFE(마우스 좌상단 이동) 포함
            self._stop_reason = f"입력 중단: {e}"
            self._stop_req.set()
            return False
        self.clicks += 1
        self._counters()
        self._log(result.state_id, "클릭", f"{target} @({sx},{sy})",
                  match2.score)
        return True
