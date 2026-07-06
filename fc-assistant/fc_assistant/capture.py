"""화면 캡처 (Capture Manager) - MSS 기반.

지정 영역만 빠르게 캡처해 OpenCV(BGR ndarray)로 넘긴다.
mss 인스턴스는 스레드별로 만들어야 하므로 사용하는 스레드에서 생성한다.
"""

import numpy as np


class CaptureManager:
    def __init__(self):
        self._sct = None

    def _ensure(self):
        if self._sct is None:
            import mss  # 지연 임포트: 헤드리스 환경 셀프테스트 대비
            self._sct = mss.mss()

    def grab(self, region: dict) -> np.ndarray:
        """region={'left','top','width','height'} -> BGR ndarray."""
        self._ensure()
        shot = self._sct.grab(region)
        img = np.asarray(shot)          # BGRA
        return np.ascontiguousarray(img[:, :, :3])  # BGR

    def close(self):
        if self._sct is not None:
            try:
                self._sct.close()
            except Exception:
                pass
            self._sct = None
