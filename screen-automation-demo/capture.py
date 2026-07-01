"""
[1단계] 화면 캡처
----------------
mss 로 화면(또는 특정 영역)을 빠르게 스크린샷 → OpenCV가 다루는 BGR numpy 배열로 변환.
"""
import numpy as np
import cv2
import mss


def grab(region=None):
    """화면을 캡처해 BGR numpy 배열로 반환.

    region=None            -> 주 모니터 전체
    region=(l, t, w, h)    -> (left, top, width, height) 영역만
    """
    with mss.mss() as sct:
        if region is None:
            monitor = sct.monitors[1]  # 0은 '전체 가상 화면', 1이 주 모니터
        else:
            left, top, width, height = region
            monitor = {"left": left, "top": top, "width": width, "height": height}
        shot = sct.grab(monitor)
        # mss 는 BGRA 로 주므로 BGR 로 변환 (OpenCV 표준)
        return cv2.cvtColor(np.array(shot), cv2.COLOR_BGRA2BGR)
