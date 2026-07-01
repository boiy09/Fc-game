"""
이미지 매칭 로직 셀프 테스트 — 디스플레이(GUI) 없이도 실행 가능.

합성 이미지를 메모리에서 만들어 locate_in / locate_all_in / Match 좌표 계산을 검증한다.
실행:  python image_automation/tests/test_matching.py
       (또는 pytest 로도 동작)
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import image_automation as ia  # noqa: E402
from image_automation import (  # noqa: E402
    Controller,
    Match,
    locate_all_in,
    locate_in,
    run_steps,
)


def _canvas(w=400, h=300, color=(30, 30, 30)):
    img = np.zeros((h, w, 3), dtype=np.uint8)
    img[:] = color
    return img


def _stamp(canvas, patch, x, y):
    """canvas 의 (x, y) 위치에 patch 를 붙인다."""
    ph, pw = patch.shape[:2]
    canvas[y:y + ph, x:x + pw] = patch
    return canvas


def _make_patch(w=40, h=24, color=(200, 120, 60)):
    p = np.zeros((h, w, 3), dtype=np.uint8)
    p[:] = color
    p[2:-2, 2:-2] = (255, 255, 255)  # 안쪽 흰 사각형으로 특징 부여
    return p


def test_locate_found_at_expected_position():
    canvas = _canvas()
    patch = _make_patch()
    _stamp(canvas, patch, 150, 90)

    m = locate_in(canvas, patch, confidence=0.9)
    assert m is not None, "심어둔 패치를 찾지 못했습니다"
    assert m.left == 150 and m.top == 90, f"위치 오차: {m.left},{m.top}"
    assert m.confidence > 0.99, f"신뢰도가 낮음: {m.confidence}"
    # 중심 좌표 검증
    assert m.center == (150 + 20, 90 + 12), f"중심 좌표 오류: {m.center}"
    print(f"[OK] locate_in: center={m.center} conf={m.confidence:.4f}")


def test_locate_not_found_when_absent():
    canvas = _canvas()
    patch = _make_patch(color=(10, 240, 10))  # 캔버스에 없는 패턴
    # 캔버스에는 아무것도 심지 않음 → 못 찾아야 함
    m = locate_in(canvas, patch, confidence=0.95)
    assert m is None, "없는 이미지를 찾았다고 잘못 보고했습니다"
    print("[OK] locate_in: 없는 이미지는 None 반환")


def test_locate_all_finds_multiple():
    canvas = _canvas(w=500, h=300)
    patch = _make_patch()
    positions = [(20, 20), (200, 50), (350, 200)]
    for (x, y) in positions:
        _stamp(canvas, patch, x, y)

    matches = locate_all_in(canvas, patch, confidence=0.9)
    assert len(matches) == 3, f"3개를 기대했지만 {len(matches)}개 발견"
    found = sorted((m.left, m.top) for m in matches)
    assert found == sorted(positions), f"위치 불일치: {found}"
    print(f"[OK] locate_all_in: {len(matches)}개 정확히 발견 {found}")


def test_template_larger_than_haystack_raises():
    small = _canvas(w=30, h=30)
    big = _canvas(w=100, h=100)
    try:
        locate_in(small, big)
    except ValueError:
        print("[OK] 템플릿이 더 큰 경우 ValueError 발생")
        return
    raise AssertionError("템플릿이 더 큰 경우 예외가 발생해야 합니다")


def test_match_center_math():
    m = Match(left=100, top=50, width=40, height=20, confidence=1.0)
    assert m.center == (120, 60)
    assert m.center_x == 120 and m.center_y == 60
    print("[OK] Match 중심 좌표 계산 정확")


class _RecordingController(Controller):
    """실제 입력 대신 호출 내역만 기록하는 컨트롤러(통합 테스트용)."""

    def __init__(self):
        super().__init__(dry_run=True)
        self.calls = []

    def click(self, x, y, **kw):
        self.calls.append(("click", x, y, kw))

    def type_text(self, text, **kw):
        self.calls.append(("type", text, kw))


def test_run_steps_search_then_click(tmp_path=None, monkeypatch=None):
    """검색→클릭 전체 파이프라인: 합성 화면을 주입하고 올바른 절대좌표로 클릭하는지 검증."""
    import tempfile

    workdir = tempfile.mkdtemp()
    patch = _make_patch()
    # 300,120 에 템플릿을 심은 가짜 화면을 만든다
    screen = _canvas(w=640, h=480)
    _stamp(screen, patch, 300, 120)

    template_path = os.path.join(workdir, "btn.png")
    import cv2  # 로컬 import (테스트에서만)
    cv2.imwrite(template_path, patch)

    # grab_screen 을 합성 화면으로 대체
    orig_grab = ia.grab_screen
    ia.grab_screen = lambda region=None: screen.copy()
    try:
        ctrl = _RecordingController()
        config = {
            "defaults": {"confidence": 0.9, "timeout": 1},
            "steps": [
                {"name": "버튼 클릭", "action": "click", "template": template_path,
                 "offset": [0, 0]},
            ],
        }
        ok = run_steps(config, controller=ctrl)
    finally:
        ia.grab_screen = orig_grab

    assert ok, "시나리오가 실패로 보고됨"
    assert len(ctrl.calls) == 1, f"클릭이 1회여야 함: {ctrl.calls}"
    _, x, y, _ = ctrl.calls[0]
    # 패치 40x24 를 (300,120)에 심었으니 중심은 (320, 132)
    assert (x, y) == (320, 132), f"클릭 좌표 오류: {(x, y)}"
    print(f"[OK] run_steps: 검색→클릭 좌표 정확 ({x}, {y})")


def test_run_steps_optional_missing_is_skipped():
    """optional 단계에서 이미지를 못 찾아도 중단하지 않고 성공 반환하는지 검증."""
    ia_grab = ia.grab_screen
    ia.grab_screen = lambda region=None: _canvas(w=200, h=200)  # 아무것도 없는 화면
    try:
        patch = _make_patch(color=(1, 2, 3))
        import cv2
        import tempfile
        p = os.path.join(tempfile.mkdtemp(), "missing.png")
        cv2.imwrite(p, patch)
        ctrl = _RecordingController()
        config = {
            "defaults": {"confidence": 0.99, "timeout": 0.2, "interval": 0.05},
            "steps": [
                {"name": "없는 버튼", "action": "click", "template": p, "optional": True},
            ],
        }
        ok = run_steps(config, controller=ctrl)
    finally:
        ia.grab_screen = ia_grab
    assert ok, "optional 단계 실패 시에도 True 여야 함"
    assert ctrl.calls == [], "클릭이 실행되면 안 됨"
    print("[OK] run_steps: optional 단계 누락은 건너뜀")


def _run_all():
    tests = [
        test_locate_found_at_expected_position,
        test_locate_not_found_when_absent,
        test_locate_all_finds_multiple,
        test_template_larger_than_haystack_raises,
        test_match_center_math,
        test_run_steps_search_then_click,
        test_run_steps_optional_missing_is_skipped,
    ]
    failed = 0
    for t in tests:
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"[FAIL] {t.__name__}: {e}")
    print(f"\n결과: {len(tests) - failed}/{len(tests)} 통과")
    return failed == 0


if __name__ == "__main__":
    raise SystemExit(0 if _run_all() else 1)
