#!/usr/bin/env python3
"""
image_automation — 화면에서 이미지를 찾아(Image Search) 마우스 클릭 또는 키보드 입력을 자동으로 수행하는 도구.

핵심 개념
---------
1. 이미지 서치 : 미리 캡처해 둔 "템플릿 이미지"(예: 버튼 스크린샷)를 현재 화면에서 찾습니다.
                 OpenCV 템플릿 매칭(cv2.matchTemplate)을 사용하며, 일치 신뢰도(confidence)로 판정합니다.
2. 동작(Action): 찾은 위치에 마우스 클릭 / 이동 / 드래그 / 스크롤을 하거나,
                 키보드로 문자열 입력 / 키 누르기 / 단축키를 실행합니다.

세 가지 사용법
--------------
- 라이브러리로 import 해서 사용
- CLI 단발 명령: find / click / type / press / hotkey / move
- CLI 시나리오 실행: run --config steps.json  (여러 단계를 순서대로 자동 실행)

의존성
------
- opencv-python(cv2), numpy : 이미지 매칭 (필수)
- mss                       : 빠른 화면 캡처 (없으면 pyautogui로 대체)
- pyautogui                 : 마우스/키보드 제어 (실제 동작 시 필요)

주의: 화면 캡처/입력 제어는 GUI 세션이 필요합니다. 헤드리스(디스플레이 없는) 환경에서는
      이미지 매칭 로직(locate_in 등)만 동작하며, 실제 클릭/입력은 사용자의 데스크톱에서 실행하세요.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Sequence, Tuple, Union

try:
    import numpy as np
except ImportError:  # pragma: no cover
    print("[에러] numpy 가 필요합니다.  pip install numpy", file=sys.stderr)
    raise

try:
    import cv2
except ImportError:  # pragma: no cover
    print("[에러] opencv 가 필요합니다.  pip install opencv-python", file=sys.stderr)
    raise


def _force_utf8_output() -> None:
    """stdout/stderr 를 UTF-8 로 강제한다.

    Windows 콘솔·CI 는 기본 인코딩이 cp1252/cp949 라서 한글 출력 시
    UnicodeEncodeError 로 프로그램이 죽을 수 있다. errors='replace' 로
    최악의 경우에도 크래시 없이 진행한다. (Python 3.7+ reconfigure)
    """
    for name in ("stdout", "stderr"):
        stream = getattr(sys, name, None)
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError, OSError):
            pass  # reconfigure 불가(캡처된 스트림/None 등)면 조용히 넘어감


_force_utf8_output()  # import 시점에 적용 → CLI·대화형·exe·테스트 모두 커버


# region = (left, top, width, height) — 화면 일부만 탐색할 때 사용
Region = Tuple[int, int, int, int]


@dataclass
class Match:
    """이미지 서치 결과 한 건. 좌표는 화면 절대 좌표(px)."""

    left: int
    top: int
    width: int
    height: int
    confidence: float

    @property
    def center(self) -> Tuple[int, int]:
        return (self.left + self.width // 2, self.top + self.height // 2)

    @property
    def center_x(self) -> int:
        return self.left + self.width // 2

    @property
    def center_y(self) -> int:
        return self.top + self.height // 2

    def as_dict(self) -> dict:
        d = asdict(self)
        d["center"] = list(self.center)
        return d


# --------------------------------------------------------------------------- #
# 화면 캡처
# --------------------------------------------------------------------------- #
def grab_screen(region: Optional[Region] = None) -> "np.ndarray":
    """현재 화면(또는 region 영역)을 BGR numpy 배열로 캡처한다.

    mss 가 설치돼 있으면 mss 로(빠름), 없으면 pyautogui 로 대체한다.
    """
    # 1순위: mss (빠르고 멀티모니터 지원)
    try:
        import mss  # noqa: WPS433 (지연 import — 헤드리스에서 import 실패를 피하기 위함)

        with mss.mss() as sct:
            if region is not None:
                left, top, width, height = region
                monitor = {"left": left, "top": top, "width": width, "height": height}
            else:
                monitor = sct.monitors[0]  # 전체 가상 화면(모든 모니터)
            shot = sct.grab(monitor)
            img = np.asarray(shot)  # BGRA
            return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    except ImportError:
        pass

    # 2순위: pyautogui (Pillow 기반)
    try:
        import pyautogui  # noqa: WPS433

        if region is not None:
            pil = pyautogui.screenshot(region=region)
        else:
            pil = pyautogui.screenshot()
        img = np.array(pil)  # RGB
        return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "화면 캡처에 실패했습니다. GUI 세션에서 실행 중인지, "
            "그리고 mss 또는 pyautogui 가 설치돼 있는지 확인하세요.\n"
            f"원인: {exc}"
        ) from exc


# --------------------------------------------------------------------------- #
# 이미지 매칭 (순수 함수 — 화면/디스플레이 없이도 테스트 가능)
# --------------------------------------------------------------------------- #
def load_image(path: str) -> "np.ndarray":
    """파일에서 BGR 이미지를 읽는다."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"이미지를 읽을 수 없습니다: {path}")
    return img


def _to_gray(img: "np.ndarray") -> "np.ndarray":
    if img.ndim == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def locate_in(
    haystack: "np.ndarray",
    needle: "np.ndarray",
    confidence: float = 0.8,
    grayscale: bool = True,
) -> Optional[Match]:
    """haystack(큰 이미지) 안에서 needle(템플릿)의 최적 위치를 찾는다.

    confidence 이상으로 일치하는 위치가 있으면 Match, 없으면 None.
    좌표는 haystack 기준 상대 좌표다(호출부에서 region offset 을 더해 절대좌표로 변환).
    """
    if needle.shape[0] > haystack.shape[0] or needle.shape[1] > haystack.shape[1]:
        raise ValueError(
            "템플릿 이미지가 탐색 대상보다 큽니다 "
            f"(템플릿 {needle.shape[1]}x{needle.shape[0]}, 대상 {haystack.shape[1]}x{haystack.shape[0]}). "
            "region 을 넓히거나 더 작은 템플릿을 사용하세요."
        )

    hay = _to_gray(haystack) if grayscale else haystack
    ndl = _to_gray(needle) if grayscale else needle

    result = cv2.matchTemplate(hay, ndl, cv2.TM_CCOEFF_NORMED)
    _min_val, max_val, _min_loc, max_loc = cv2.minMaxLoc(result)

    if max_val < confidence:
        return None

    h, w = needle.shape[:2]
    return Match(left=int(max_loc[0]), top=int(max_loc[1]), width=int(w), height=int(h),
                 confidence=float(max_val))


def locate_all_in(
    haystack: "np.ndarray",
    needle: "np.ndarray",
    confidence: float = 0.8,
    grayscale: bool = True,
    max_results: int = 100,
) -> List[Match]:
    """confidence 이상으로 일치하는 모든 위치를 반환한다(겹치는 것은 NMS 로 제거)."""
    hay = _to_gray(haystack) if grayscale else haystack
    ndl = _to_gray(needle) if grayscale else needle
    h, w = needle.shape[:2]

    result = cv2.matchTemplate(hay, ndl, cv2.TM_CCOEFF_NORMED)
    ys, xs = np.where(result >= confidence)
    candidates = sorted(
        (Match(int(x), int(y), int(w), int(h), float(result[y, x])) for y, x in zip(ys, xs)),
        key=lambda m: m.confidence,
        reverse=True,
    )

    # 비최대 억제(NMS): 이미 선택된 박스와 절반 이상 겹치면 버림
    kept: List[Match] = []
    for cand in candidates:
        if all(not _overlaps(cand, k, w, h) for k in kept):
            kept.append(cand)
            if len(kept) >= max_results:
                break
    return kept


def _overlaps(a: Match, b: Match, w: int, h: int) -> bool:
    return abs(a.left - b.left) < w * 0.5 and abs(a.top - b.top) < h * 0.5


# --------------------------------------------------------------------------- #
# 화면에서 찾기 (캡처 + 매칭 + 좌표 보정)
# --------------------------------------------------------------------------- #
def locate_on_screen(
    template: Union[str, "np.ndarray"],
    region: Optional[Region] = None,
    confidence: float = 0.8,
    grayscale: bool = True,
) -> Optional[Match]:
    """화면(또는 region)에서 템플릿을 찾아 절대 좌표 Match 로 반환한다."""
    needle = load_image(template) if isinstance(template, str) else template
    screen = grab_screen(region)
    match = locate_in(screen, needle, confidence=confidence, grayscale=grayscale)
    if match is None:
        return None
    if region is not None:  # region 상대좌표 → 화면 절대좌표
        match.left += region[0]
        match.top += region[1]
    return match


def wait_for(
    template: Union[str, "np.ndarray"],
    timeout: float = 10.0,
    interval: float = 0.5,
    region: Optional[Region] = None,
    confidence: float = 0.8,
    grayscale: bool = True,
) -> Optional[Match]:
    """템플릿이 화면에 나타날 때까지 interval 간격으로 폴링한다(최대 timeout 초)."""
    needle = load_image(template) if isinstance(template, str) else template
    deadline = time.monotonic() + timeout
    while True:
        match = locate_on_screen(needle, region=region, confidence=confidence, grayscale=grayscale)
        if match is not None:
            return match
        if time.monotonic() >= deadline:
            return None
        time.sleep(interval)


# --------------------------------------------------------------------------- #
# 마우스 / 키보드 제어 (pyautogui 지연 import)
# --------------------------------------------------------------------------- #
class Controller:
    """마우스·키보드 동작을 감싼 얇은 래퍼. pyautogui 를 실제 동작 시점에만 import 한다."""

    def __init__(self, pause: float = 0.05, failsafe: bool = True, dry_run: bool = False):
        self.pause = pause
        self.failsafe = failsafe
        self.dry_run = dry_run  # True 면 실제 입력 없이 로그만 출력(좌표 확인용)
        self._gui = None

    def _pyautogui(self):
        if self.dry_run:
            return None
        if self._gui is None:
            try:
                import pyautogui  # noqa: WPS433
            except Exception as exc:  # pragma: no cover
                raise RuntimeError(
                    "마우스/키보드 제어에는 pyautogui 가 필요하며 GUI 세션에서 실행해야 합니다.\n"
                    "  설치: pip install pyautogui\n"
                    f"  원인: {exc}"
                ) from exc
            pyautogui.PAUSE = self.pause
            pyautogui.FAILSAFE = self.failsafe  # 마우스를 화면 좌상단 모서리로 옮기면 비상 중단
            self._gui = pyautogui
        return self._gui

    # -- 마우스 -------------------------------------------------------------- #
    def move(self, x: int, y: int, duration: float = 0.0) -> None:
        print(f"[동작] 마우스 이동 → ({x}, {y})")
        gui = self._pyautogui()
        if gui:
            gui.moveTo(x, y, duration=duration)

    def click(self, x: int, y: int, button: str = "left", clicks: int = 1,
              interval: float = 0.0, duration: float = 0.0) -> None:
        print(f"[동작] 클릭 → ({x}, {y}) button={button} clicks={clicks}")
        gui = self._pyautogui()
        if gui:
            gui.click(x=x, y=y, clicks=clicks, interval=interval, button=button, duration=duration)

    def drag(self, x1: int, y1: int, x2: int, y2: int, button: str = "left",
             duration: float = 0.3) -> None:
        print(f"[동작] 드래그 → ({x1}, {y1}) → ({x2}, {y2})")
        gui = self._pyautogui()
        if gui:
            gui.moveTo(x1, y1)
            gui.dragTo(x2, y2, button=button, duration=duration)

    def scroll(self, amount: int, x: Optional[int] = None, y: Optional[int] = None) -> None:
        print(f"[동작] 스크롤 {amount} at ({x}, {y})")
        gui = self._pyautogui()
        if gui:
            gui.scroll(amount, x=x, y=y)

    # -- 키보드 -------------------------------------------------------------- #
    def type_text(self, text: str, interval: float = 0.0) -> None:
        print(f"[동작] 문자열 입력 → {text!r}")
        gui = self._pyautogui()
        if gui:
            gui.typewrite(text, interval=interval)

    def press(self, keys: Union[str, Sequence[str]], presses: int = 1,
              interval: float = 0.0) -> None:
        print(f"[동작] 키 누르기 → {keys}")
        gui = self._pyautogui()
        if gui:
            gui.press(keys, presses=presses, interval=interval)

    def hotkey(self, *keys: str) -> None:
        print(f"[동작] 단축키 → {'+'.join(keys)}")
        gui = self._pyautogui()
        if gui:
            gui.hotkey(*keys)


# --------------------------------------------------------------------------- #
# 시나리오(steps) 실행기
# --------------------------------------------------------------------------- #
def run_steps(config: dict, controller: Optional[Controller] = None) -> bool:
    """JSON 설정에 정의된 단계들을 순서대로 실행한다.

    config 예시는 examples/steps.example.json 참고.
    반환값: 모든 단계 성공 시 True, 필수(required) 단계 실패 시 False.
    """
    defaults = config.get("defaults", {})
    d_conf = float(defaults.get("confidence", 0.8))
    d_timeout = float(defaults.get("timeout", 10.0))
    d_interval = float(defaults.get("interval", 0.5))
    d_grayscale = bool(defaults.get("grayscale", True))
    base_region = _parse_region(defaults.get("region"))

    ctrl = controller or Controller(
        pause=float(defaults.get("pause", 0.05)),
        failsafe=bool(defaults.get("failsafe", True)),
        dry_run=bool(defaults.get("dry_run", False)),
    )

    steps = config.get("steps", [])
    for i, step in enumerate(steps, 1):
        action = step.get("action", "click")
        name = step.get("name", f"step {i}")
        print(f"\n=== [{i}/{len(steps)}] {name} (action={action}) ===")

        # 이미지가 필요 없는 동작
        if action == "wait":
            secs = float(step.get("seconds", 1.0))
            print(f"[동작] {secs}초 대기")
            time.sleep(secs)
            continue
        if action == "hotkey":
            ctrl.hotkey(*step["keys"])
            continue
        if action == "press" and "template" not in step:
            ctrl.press(step["keys"], presses=int(step.get("presses", 1)))
            continue
        if action == "type" and "template" not in step:
            ctrl.type_text(step["text"], interval=float(step.get("interval", 0.0)))
            continue

        # 이미지 서치가 필요한 동작
        template = step["template"]
        region = _parse_region(step.get("region")) or base_region
        confidence = float(step.get("confidence", d_conf))
        timeout = float(step.get("timeout", d_timeout))
        grayscale = bool(step.get("grayscale", d_grayscale))

        match = wait_for(template, timeout=timeout, interval=d_interval,
                         region=region, confidence=confidence, grayscale=grayscale)
        if match is None:
            msg = f"[실패] 이미지를 찾지 못함: {template} (timeout={timeout}s, conf>={confidence})"
            if step.get("required", True) and not step.get("optional", False):
                print(msg + "  → 필수 단계이므로 중단합니다.")
                return False
            print(msg + "  → optional 단계이므로 건너뜁니다.")
            continue

        print(f"[검색] 발견: center={match.center} conf={match.confidence:.3f}")
        dx, dy = step.get("offset", [0, 0])
        tx, ty = match.center_x + int(dx), match.center_y + int(dy)

        if action == "click":
            ctrl.click(tx, ty, button=step.get("button", "left"),
                       clicks=int(step.get("clicks", 1)))
        elif action == "move":
            ctrl.move(tx, ty)
        elif action == "type":
            ctrl.click(tx, ty)  # 먼저 해당 위치를 클릭해 포커스
            ctrl.type_text(step["text"], interval=float(step.get("interval", 0.0)))
        elif action == "press":
            ctrl.click(tx, ty)
            ctrl.press(step["keys"], presses=int(step.get("presses", 1)))
        else:
            print(f"[경고] 알 수 없는 action: {action} — 건너뜁니다.")

    print("\n=== 시나리오 완료 ===")
    return True


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _parse_region(value) -> Optional[Region]:
    """'left,top,width,height' 문자열 또는 [l,t,w,h] 리스트를 Region 으로 변환."""
    if value is None:
        return None
    if isinstance(value, str):
        parts = [int(p) for p in value.replace(" ", "").split(",")]
    else:
        parts = [int(p) for p in value]
    if len(parts) != 4:
        raise ValueError("region 은 4개 값(left,top,width,height)이어야 합니다.")
    return (parts[0], parts[1], parts[2], parts[3])


def _add_search_args(p: argparse.ArgumentParser) -> None:
    p.add_argument("--template", "-t", required=True, help="찾을 이미지 파일 경로(PNG 등)")
    p.add_argument("--region", "-r", default=None,
                   help="탐색 영역 'left,top,width,height' (기본: 전체 화면)")
    p.add_argument("--confidence", "-c", type=float, default=0.8,
                   help="일치 신뢰도 0~1 (기본 0.8)")
    p.add_argument("--timeout", type=float, default=0.0,
                   help="이미지가 나타날 때까지 대기할 최대 초(기본 0=한 번만 탐색)")
    p.add_argument("--interval", type=float, default=0.5, help="폴링 간격 초(기본 0.5)")
    p.add_argument("--no-grayscale", action="store_true", help="흑백 변환 없이 컬러로 매칭")
    p.add_argument("--dry-run", action="store_true", help="실제 입력 없이 찾은 좌표만 출력")


def _find_match(args) -> Optional[Match]:
    region = _parse_region(args.region)
    grayscale = not args.no_grayscale
    if args.timeout and args.timeout > 0:
        return wait_for(args.template, timeout=args.timeout, interval=args.interval,
                        region=region, confidence=args.confidence, grayscale=grayscale)
    return locate_on_screen(args.template, region=region,
                            confidence=args.confidence, grayscale=grayscale)


def _target_xy(match: Match, offset: Optional[Sequence[int]]) -> Tuple[int, int]:
    dx, dy = (offset or [0, 0])
    return match.center_x + int(dx), match.center_y + int(dy)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="image_automation",
        description="화면에서 이미지를 찾아 마우스 클릭/키보드 입력을 자동 수행합니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "예시:\n"
            "  # 버튼 이미지를 찾아 클릭\n"
            "  python image_automation.py click -t button.png -c 0.85 --timeout 5\n\n"
            "  # 입력창 이미지를 찾아 클릭 후 문자열 입력\n"
            "  python image_automation.py type -t input_box.png --text '홍길동'\n\n"
            "  # 찾은 위치에서 엔터 키\n"
            "  python image_automation.py press -t input_box.png --keys enter\n\n"
            "  # 시나리오 파일 실행\n"
            "  python image_automation.py run --config steps.json\n\n"
            "  # 좌표만 확인(실제 클릭 안 함)\n"
            "  python image_automation.py find -t button.png\n"
        ),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # find
    p_find = sub.add_parser("find", help="이미지를 찾아 좌표/신뢰도만 출력")
    _add_search_args(p_find)
    p_find.add_argument("--all", action="store_true", help="일치하는 모든 위치 출력")
    p_find.add_argument("--json", action="store_true", help="결과를 JSON 으로 출력")

    # click
    p_click = sub.add_parser("click", help="이미지를 찾아 클릭")
    _add_search_args(p_click)
    p_click.add_argument("--button", default="left", choices=["left", "right", "middle"])
    p_click.add_argument("--clicks", type=int, default=1, help="클릭 횟수(2=더블클릭)")
    p_click.add_argument("--offset", type=int, nargs=2, metavar=("DX", "DY"),
                         default=[0, 0], help="중심으로부터의 클릭 오프셋")

    # move
    p_move = sub.add_parser("move", help="이미지를 찾아 마우스만 이동")
    _add_search_args(p_move)
    p_move.add_argument("--offset", type=int, nargs=2, metavar=("DX", "DY"), default=[0, 0])

    # type
    p_type = sub.add_parser("type", help="이미지를 찾아 클릭 후 문자열 입력")
    _add_search_args(p_type)
    p_type.add_argument("--text", required=True, help="입력할 문자열")
    p_type.add_argument("--type-interval", type=float, default=0.0, help="글자 간 간격 초")
    p_type.add_argument("--offset", type=int, nargs=2, metavar=("DX", "DY"), default=[0, 0])

    # press
    p_press = sub.add_parser("press", help="이미지를 찾아 클릭 후 키 누르기")
    _add_search_args(p_press)
    p_press.add_argument("--keys", nargs="+", required=True,
                         help="누를 키(예: enter / tab / ctrl). 여러 개면 순서대로")
    p_press.add_argument("--offset", type=int, nargs=2, metavar=("DX", "DY"), default=[0, 0])

    # run
    p_run = sub.add_parser("run", help="JSON 시나리오 파일 실행")
    p_run.add_argument("--config", "-f", required=True, help="steps JSON 파일 경로")
    p_run.add_argument("--dry-run", action="store_true", help="실제 입력 없이 시뮬레이션")

    return parser


def _cmd_run(args) -> int:
    with open(args.config, encoding="utf-8") as f:
        config = json.load(f)
    if args.dry_run:
        config.setdefault("defaults", {})["dry_run"] = True
    return 0 if run_steps(config) else 1


def _cmd_find(args) -> int:
    region = _parse_region(args.region)
    if getattr(args, "all", False):
        needle = load_image(args.template)
        screen = grab_screen(region)
        matches = locate_all_in(screen, needle, confidence=args.confidence,
                                grayscale=not args.no_grayscale)
        if region:
            for m in matches:
                m.left += region[0]
                m.top += region[1]
        if args.json:
            print(json.dumps([m.as_dict() for m in matches], ensure_ascii=False, indent=2))
        else:
            print(f"{len(matches)}개 발견:")
            for m in matches:
                print(f"  center={m.center} conf={m.confidence:.3f} "
                      f"box=({m.left},{m.top},{m.width},{m.height})")
        return 0 if matches else 2

    match = _find_match(args)
    if match is None:
        print("이미지를 찾지 못했습니다.", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(match.as_dict(), ensure_ascii=False, indent=2))
    else:
        print(f"발견: center={match.center} conf={match.confidence:.3f} "
              f"box=({match.left},{match.top},{match.width},{match.height})")
    return 0


def _cmd_action(args) -> int:
    """click / move / type / press — 이미지 검색 후 동작 실행."""
    match = _find_match(args)
    if match is None:
        print("이미지를 찾지 못했습니다. 동작을 실행하지 않습니다.", file=sys.stderr)
        return 2

    print(f"발견: center={match.center} conf={match.confidence:.3f}")
    ctrl = Controller(dry_run=getattr(args, "dry_run", False))
    tx, ty = _target_xy(match, getattr(args, "offset", [0, 0]))

    if args.command == "click":
        ctrl.click(tx, ty, button=args.button, clicks=args.clicks)
    elif args.command == "move":
        ctrl.move(tx, ty)
    elif args.command == "type":
        ctrl.click(tx, ty)
        ctrl.type_text(args.text, interval=args.type_interval)
    elif args.command == "press":
        ctrl.click(tx, ty)
        ctrl.press(args.keys if len(args.keys) > 1 else args.keys[0])
    return 0


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "run":
            return _cmd_run(args)
        if args.command == "find":
            return _cmd_find(args)
        return _cmd_action(args)
    except KeyboardInterrupt:
        print("\n중단되었습니다.", file=sys.stderr)
        return 130
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        # 파일 없음 / 잘못된 인자 / 화면 캡처·입력 실패 등을 traceback 없이 깔끔히 보고
        print(f"[에러] {exc}", file=sys.stderr)
        return 1


# --------------------------------------------------------------------------- #
# 대화형 모드 — exe 를 더블클릭하거나 인자 없이 실행하면 메뉴가 뜬다
# --------------------------------------------------------------------------- #
def _ask(prompt: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    try:
        val = input(f"{prompt}{suffix}: ").strip()
    except EOFError:
        return default
    return val or default


def _countdown(seconds: int) -> None:
    if seconds <= 0:
        return
    print(f"{seconds}초 후 실행합니다. 대상 창을 클릭해 활성화하세요...")
    for i in range(seconds, 0, -1):
        print(f"  {i}...", end="", flush=True)
        time.sleep(1)
    print(" 시작!")


def interactive() -> int:
    """메뉴 기반 대화형 실행(그래픽 세션 필요)."""
    print("=" * 56)
    print(" image_automation — 이미지 서치 자동화 (대화형 모드)")
    print("=" * 56)
    print("찾을 버튼/아이콘 영역을 미리 PNG 로 캡처해 두세요.\n")

    while True:
        print("\n무엇을 할까요?")
        print("  1) 이미지 찾기 (좌표만 확인, 클릭 안 함)")
        print("  2) 이미지 찾아 클릭")
        print("  3) 이미지 찾아 문자열 입력")
        print("  4) 이미지 찾아 키 입력 (예: enter)")
        print("  5) 시나리오(JSON) 파일 실행")
        print("  0) 종료")
        choice = _ask("선택", "0")

        try:
            if choice == "0":
                print("종료합니다.")
                return 0

            if choice == "5":
                cfg = _ask("시나리오 JSON 경로", "examples/steps.example.json")
                with open(cfg, encoding="utf-8") as f:
                    config = json.load(f)
                run_steps(config)
                continue

            template = _ask("찾을 이미지 파일 경로")
            if not template:
                print("경로가 비어 있습니다.")
                continue
            confidence = float(_ask("신뢰도(0~1)", "0.8"))
            timeout = float(_ask("최대 대기 초(0=한 번만)", "5"))

            # 찾기만
            if choice == "1":
                m = wait_for(template, timeout=timeout, confidence=confidence) if timeout > 0 \
                    else locate_on_screen(template, confidence=confidence)
                if m:
                    print(f"[결과] 발견! center={m.center} conf={m.confidence:.3f}")
                else:
                    print("[결과] 찾지 못했습니다. 신뢰도를 낮추거나 이미지를 다시 캡처해 보세요.")
                continue

            # 실행 전 준비 시간
            wait_before = int(float(_ask("실행 전 대기 초(창 전환용)", "3")))
            _countdown(wait_before)

            m = wait_for(template, timeout=timeout, confidence=confidence) if timeout > 0 \
                else locate_on_screen(template, confidence=confidence)
            if not m:
                print("[결과] 이미지를 찾지 못했습니다. 동작을 실행하지 않습니다.")
                continue
            print(f"[검색] 발견 center={m.center} conf={m.confidence:.3f}")

            ctrl = Controller()
            if choice == "2":
                clicks = int(_ask("클릭 횟수(2=더블클릭)", "1"))
                button = _ask("버튼(left/right/middle)", "left")
                ctrl.click(*m.center, button=button, clicks=clicks)
            elif choice == "3":
                text = _ask("입력할 문자열")
                ctrl.click(*m.center)
                ctrl.type_text(text)
            elif choice == "4":
                keys = _ask("누를 키(공백으로 여러 개, 예: ctrl s)", "enter").split()
                ctrl.click(*m.center)
                ctrl.press(keys if len(keys) > 1 else keys[0])
            else:
                print("알 수 없는 선택입니다.")
        except KeyboardInterrupt:
            print("\n취소되었습니다.")
        except Exception as exc:  # noqa: BLE001  대화형에서는 오류로 종료하지 않고 메뉴로 복귀
            print(f"[에러] {exc}")


def _run_cli_or_interactive() -> int:
    """인자가 있으면 CLI, 없으면(더블클릭 등) 대화형 모드로 진입한다."""
    argv = sys.argv[1:]
    if argv:
        return main(argv)
    code = interactive()
    # PyInstaller 로 만든 exe 를 더블클릭한 경우, 창이 바로 닫히지 않도록 대기
    if getattr(sys, "frozen", False):
        try:
            input("\n창을 닫으려면 Enter 키를 누르세요...")
        except EOFError:
            pass
    return code


if __name__ == "__main__":
    raise SystemExit(_run_cli_or_interactive())
