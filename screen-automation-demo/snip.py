"""
snip.py — 템플릿 이미지 만들기 도우미
------------------------------------
화면을 캡처한 뒤 마우스로 영역을 드래그하면 그 부분을 template.png 로 저장한다.
(찾고 싶은 버튼/아이콘을 손으로 잘라내는 과정)

사용법:
    python snip.py
    -> 3초 뒤 캡처 -> 드래그로 영역 선택 -> Enter 저장 / c 취소
"""
import time
import cv2

from capture import grab


def main():
    print("3초 뒤 화면을 캡처합니다. 대상 화면을 띄워 두세요...")
    time.sleep(3)
    screen = grab()

    print("드래그로 영역 선택 후 Enter (취소: c)")
    x, y, w, h = cv2.selectROI("select template (Enter=저장 / c=취소)",
                               screen, showCrosshair=True)
    cv2.destroyAllWindows()

    if w == 0 or h == 0:
        print("선택이 취소되었습니다.")
        return

    crop = screen[y:y + h, x:x + w]
    cv2.imwrite("template.png", crop)
    print(f"저장 완료 -> template.png ({w}x{h})")


if __name__ == "__main__":
    main()
