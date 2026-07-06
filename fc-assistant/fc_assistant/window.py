"""게임 창 관리 (Window Manager) - Windows 전용.

창 제목 키워드로 FC온라인 창을 찾고, 클라이언트 영역(테두리 제외)의
화면 좌표/크기와 활성(포그라운드) 여부를 제공한다.
Windows가 아닌 환경에서는 창을 찾지 못한 것으로 처리한다.
"""

import sys
from dataclasses import dataclass

IS_WINDOWS = sys.platform == "win32"

if IS_WINDOWS:
    import ctypes
    from ctypes import wintypes

    _user32 = ctypes.windll.user32


@dataclass
class GameWindow:
    hwnd: int
    title: str
    x: int      # 클라이언트 영역 좌상단 화면 X
    y: int
    w: int      # 클라이언트 영역 크기
    h: int

    def region(self) -> dict:
        return {"left": self.x, "top": self.y,
                "width": self.w, "height": self.h}


def set_dpi_aware():
    """모니터 배율(DPI)과 무관하게 실제 픽셀 좌표를 쓰도록 설정."""
    if not IS_WINDOWS:
        return
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
    except (AttributeError, OSError):
        try:
            _user32.SetProcessDPIAware()
        except OSError:
            pass


class WindowManager:
    def __init__(self, title_keywords: list[str]):
        self.keywords = [k.lower() for k in title_keywords if k.strip()]
        self._hwnd: int | None = None

    # ---------- 탐색 ----------
    def find(self) -> GameWindow | None:
        if not IS_WINDOWS:
            return None
        if self._hwnd and _user32.IsWindow(self._hwnd):
            win = self._describe(self._hwnd)
            if win:
                return win
        self._hwnd = self._search()
        return self._describe(self._hwnd) if self._hwnd else None

    def _search(self) -> int | None:
        found: list[tuple[int, str]] = []

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def enum_proc(hwnd, _):
            if not _user32.IsWindowVisible(hwnd):
                return True
            length = _user32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            _user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value
            low = title.lower()
            if any(k in low for k in self.keywords):
                found.append((hwnd, title))
            return True

        _user32.EnumWindows(enum_proc, 0)
        return found[0][0] if found else None

    def _describe(self, hwnd: int) -> GameWindow | None:
        if not hwnd or not _user32.IsWindow(hwnd) or _user32.IsIconic(hwnd):
            return None
        rect = wintypes.RECT()
        if not _user32.GetClientRect(hwnd, ctypes.byref(rect)):
            return None
        w, h = rect.right, rect.bottom
        if w < 320 or h < 240:  # 최소화/비정상 크기
            return None
        pt = wintypes.POINT(0, 0)
        if not _user32.ClientToScreen(hwnd, ctypes.byref(pt)):
            return None
        length = _user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        _user32.GetWindowTextW(hwnd, buf, length + 1)
        return GameWindow(hwnd=hwnd, title=buf.value, x=pt.x, y=pt.y, w=w, h=h)

    # ---------- 안전 장치용 ----------
    def is_foreground(self) -> bool:
        if not IS_WINDOWS or not self._hwnd:
            return False
        return _user32.GetForegroundWindow() == self._hwnd
