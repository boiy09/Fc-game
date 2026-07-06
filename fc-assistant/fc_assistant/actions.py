"""입력 실행 (Action Controller).

인식된 버튼의 중앙만 클릭한다. 임의 좌표/랜덤 클릭은 하지 않는다.
PyAutoGUI FAILSAFE(마우스를 화면 좌상단 모서리로 이동하면 예외 발생)를
켠 상태로 사용해 사용자가 언제든 물리적으로 중단할 수 있게 한다.
"""


class ActionController:
    def __init__(self):
        self._gui = None

    def _ensure(self):
        if self._gui is None:
            import pyautogui  # 지연 임포트
            pyautogui.FAILSAFE = True
            pyautogui.PAUSE = 0.05
            self._gui = pyautogui
        return self._gui

    def click(self, screen_x: int, screen_y: int):
        gui = self._ensure()
        gui.moveTo(screen_x, screen_y, duration=0.15)
        gui.click(screen_x, screen_y)


class FailSafeTriggered(Exception):
    pass
