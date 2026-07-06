"""안전 장치 (Safety Guard) - 전역 강제 정지 단축키.

Windows에서 GetAsyncKeyState 폴링으로 F9(시작)/F10(정지) 같은 전역
단축키를 감지한다. 게임 창이 포커스를 가진 상태에서도 동작한다.
Windows가 아니면 아무 것도 하지 않는다 (UI 버튼만 사용).
"""

import sys
import threading

IS_WINDOWS = sys.platform == "win32"

VK_CODES = {
    "F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73,
    "F5": 0x74, "F6": 0x75, "F7": 0x76, "F8": 0x77,
    "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
    "ESC": 0x1B,
}


class HotkeyWatcher(threading.Thread):
    """key_name -> callback 매핑을 받아 키가 눌리는 순간 콜백을 호출한다."""

    def __init__(self, bindings: dict[str, callable], poll_ms: int = 50):
        super().__init__(daemon=True, name="HotkeyWatcher")
        self.bindings = {
            VK_CODES[k.upper()]: cb
            for k, cb in bindings.items() if k.upper() in VK_CODES
        }
        self.poll_s = poll_ms / 1000.0
        self._stop = threading.Event()

    def run(self):
        if not IS_WINDOWS or not self.bindings:
            return
        import ctypes
        user32 = ctypes.windll.user32
        pressed = {vk: False for vk in self.bindings}
        while not self._stop.wait(self.poll_s):
            for vk, cb in self.bindings.items():
                down = bool(user32.GetAsyncKeyState(vk) & 0x8000)
                if down and not pressed[vk]:
                    try:
                        cb()
                    except Exception:
                        pass
                pressed[vk] = down

    def stop(self):
        self._stop.set()
