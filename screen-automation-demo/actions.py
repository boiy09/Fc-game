"""
[3+4단계] 판단 & 입력 (상태 기반 자동화 헬퍼)
------------------------------------------
매칭 결과를 보고(판단) 마우스/키보드 입력(pyautogui)을 낸다.
- find_and_click : 지금 화면에 있으면 클릭
- wait_for_image : 나타날 때까지 기다렸다가 위치 반환 ("상태 기반" 로직의 기본형)

주의: region 을 쓰면 매칭 좌표가 그 영역 기준이므로, 클릭 시 화면 절대좌표로 보정한다.
"""
import time
import pyautogui

from capture import grab
from matcher import match_one

# 안전장치: 마우스를 화면 좌상단 끝으로 확 밀면 즉시 예외 발생 → 프로그램 정지
pyautogui.FAILSAFE = True


def _to_absolute(center, region):
    """region 기준 좌표를 화면 절대좌표로 변환."""
    if region is None:
        return center
    return (center[0] + region[0], center[1] + region[1])


def find_and_click(template, threshold=0.85, region=None, move_duration=0.2):
    """지금 화면에서 template 을 찾으면 클릭. 성공 True / 실패 False."""
    screen = grab(region)
    center, _ = match_one(screen, template, threshold)
    if center is None:
        return False
    x, y = _to_absolute(center, region)
    pyautogui.moveTo(x, y, duration=move_duration)
    pyautogui.click()
    return True


def wait_for_image(template, threshold=0.85, region=None,
                   timeout=10.0, interval=0.5):
    """template 이 나타날 때까지 대기. 나타나면 절대좌표 center, timeout 이면 None."""
    end = time.time() + timeout
    while time.time() < end:
        screen = grab(region)
        center, _ = match_one(screen, template, threshold)
        if center is not None:
            return _to_absolute(center, region)
        time.sleep(interval)
    return None
