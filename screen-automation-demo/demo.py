"""
데모 — 전체 파이프라인을 한 번에 보여주는 실행 예제
--------------------------------------------------
화면에서 template.png 를 실시간으로 찾아 위치/유사도를 출력한다.
  python demo.py            # 탐지만 (안전, 클릭 안 함)
  python demo.py --click    # 찾으면 실제로 클릭까지

연습 대상은 계산기 / 메모장 / 아무 웹 버튼 등 '본인 것'으로.
멈추기: Ctrl+C  (또는 --click 모드에서 마우스를 화면 좌상단 끝으로)
"""
import sys
import time
import cv2

from capture import grab
from matcher import match_one

TEMPLATE_PATH = "template.png"
THRESHOLD = 0.85
SCAN_INTERVAL = 1.0


def main():
    do_click = "--click" in sys.argv

    template = cv2.imread(TEMPLATE_PATH, cv2.IMREAD_COLOR)
    if template is None:
        print(f"[에러] '{TEMPLATE_PATH}' 가 없습니다. 먼저 `python snip.py` 로 만드세요.")
        return

    if do_click:
        import pyautogui
        pyautogui.FAILSAFE = True

    print(f"스캔 시작 (threshold={THRESHOLD}, click={do_click}). 멈추려면 Ctrl+C.")
    try:
        while True:
            screen = grab()                                    # 1. 캡처
            center, score = match_one(screen, template, THRESHOLD)  # 2. 매칭
            if center:                                         # 3. 판단
                print(f"  찾음   위치={center}  유사도={score:.3f}")
                if do_click:                                   # 4. 입력
                    import pyautogui
                    pyautogui.moveTo(*center, duration=0.2)
                    pyautogui.click()
                    time.sleep(1.0)  # 같은 대상 연속 클릭 방지
            else:
                print(f"  못 찾음 (최고 유사도={score:.3f})")
            time.sleep(SCAN_INTERVAL)
    except KeyboardInterrupt:
        print("\n종료했습니다.")


if __name__ == "__main__":
    main()
