"""
app.py — 통합 실행 런처
----------------------
exe 로 묶기 좋게 기능을 하나의 진입점으로 합친 메뉴형 프로그램.
  1) 템플릿 만들기 (드래그로 '찾을 이미지' 저장)
  2) 탐지만 실행 (클릭 안 함, 안전)
  3) 탐지 + 클릭 실행

멈추기: 스캔 중 Ctrl+C. (클릭 모드는 마우스를 화면 좌상단 끝으로 밀어도 정지)
"""
import os
import sys
import time

import cv2

from capture import grab
from matcher import match_one

# Windows 콘솔/파이프 기본 인코딩(cp949·cp1252)은 한글을 못 담아
# 출력 시 UnicodeEncodeError 로 죽을 수 있다. 표준 출력을 UTF-8 로 재설정해 예방.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

TEMPLATE_PATH = "template.png"
THRESHOLD = 0.85


def make_template():
    """[메뉴 1] 화면을 캡처해 드래그한 영역을 template.png 로 저장."""
    print("3초 뒤 화면을 캡처합니다. 대상 화면을 띄워 두세요...")
    time.sleep(3)
    screen = grab()
    print("드래그로 영역 선택 후 Enter (취소: c)")
    x, y, w, h = cv2.selectROI("select template (Enter=저장 / c=취소)",
                               screen, showCrosshair=True)
    cv2.destroyAllWindows()
    if w == 0 or h == 0:
        print("선택이 취소되었습니다.\n")
        return
    cv2.imwrite(TEMPLATE_PATH, screen[y:y + h, x:x + w])
    print(f"저장 완료 -> {TEMPLATE_PATH} ({w}x{h})\n")


def run(do_click):
    """[메뉴 2/3] template.png 를 실시간으로 찾아 출력(+옵션 클릭)."""
    template = cv2.imread(TEMPLATE_PATH, cv2.IMREAD_COLOR)
    if template is None:
        print(f"[안내] '{TEMPLATE_PATH}' 가 없습니다. 메뉴 1번으로 먼저 만드세요.\n")
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
                    time.sleep(1.0)  # 연속 클릭 방지
            else:
                print(f"  못 찾음 (최고 유사도={score:.3f})")
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\n스캔을 멈췄습니다.\n")


MENU = """
========================================
   화면 자동화 런처 (학습용)
========================================
  1) 템플릿 만들기 (찾을 이미지 저장)
  2) 탐지만 실행 (클릭 안 함)
  3) 탐지 + 클릭 실행
  q) 종료
----------------------------------------
선택: """


def main():
    # exe 로 실행되면 작업 폴더를 exe 위치로 맞춰, template.png 를 옆에서 찾게 한다
    if getattr(sys, "frozen", False):
        os.chdir(os.path.dirname(sys.executable))

    while True:
        choice = input(MENU).strip().lower()
        if choice == "1":
            make_template()
        elif choice == "2":
            run(do_click=False)
        elif choice == "3":
            run(do_click=True)
        elif choice == "q":
            print("종료합니다.")
            break
        else:
            print("1, 2, 3, q 중에서 선택하세요.\n")


if __name__ == "__main__":
    main()
