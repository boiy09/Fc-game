"""
[보조] OCR — 화면의 글자/숫자 읽기
--------------------------------
템플릿 매칭이 '그림'을 찾는 거라면, OCR 은 '텍스트'를 읽는다.
숫자(점수, 수량 등)를 인식할 땐 template 매칭보다 이쪽이 훨씬 편하다.

* 별도 설치 필요: Tesseract 엔진 본체
    - Ubuntu/Debian : sudo apt install tesseract-ocr
    - macOS(brew)   : brew install tesseract
    - Windows       : https://github.com/UB-Mannheim/tesseract 에서 설치
  (파이썬 pytesseract 는 이 엔진을 호출하는 래퍼일 뿐)
"""
import cv2
import pytesseract


def read_text(image, digits_only=False, lang="eng", invert=False, psm=7):
    """이미지(BGR 영역)에서 텍스트를 읽어 문자열로 반환.

    invert=True : 어두운 배경 + 밝은 글자(다크 UI)일 때 켠다.
    psm         : Tesseract 페이지 분할 모드. 7=한 줄, 6=여러 줄.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    flag = cv2.THRESH_BINARY_INV if invert else cv2.THRESH_BINARY
    # Otsu 이진화로 글자/배경 대비를 자동으로 키운다
    _, thresh = cv2.threshold(gray, 0, 255, flag + cv2.THRESH_OTSU)

    config = f"--psm {psm}"
    if digits_only:
        config += " -c tessedit_char_whitelist=0123456789"
    return pytesseract.image_to_string(thresh, lang=lang, config=config).strip()


def read_number(image, **kwargs):
    """이미지에서 숫자만 읽어 int 로 반환. 못 읽으면 None."""
    text = read_text(image, digits_only=True, **kwargs)
    digits = "".join(ch for ch in text if ch.isdigit())
    return int(digits) if digits else None
