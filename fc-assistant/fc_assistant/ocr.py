"""OCR 보조 판단 (선택 기능).

pytesseract + Tesseract 엔진이 설치된 경우에만 동작하며, 오류 팝업의
문구를 로그에 남기는 보조 용도로만 쓴다. 핵심 상태 판단은 항상
템플릿 매칭이 담당한다.
"""

import numpy as np


def available() -> bool:
    try:
        import pytesseract  # noqa: F401
        return True
    except ImportError:
        return False


def read_text(img: np.ndarray, lang: str = "kor+eng") -> str:
    """이미지에서 텍스트 추출. 실패하면 빈 문자열."""
    try:
        import cv2
        import pytesseract
        gray = img if img.ndim == 2 else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, None, fx=2.0, fy=2.0,
                          interpolation=cv2.INTER_CUBIC)
        _, binimg = cv2.threshold(gray, 0, 255,
                                  cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        text = pytesseract.image_to_string(binimg, lang=lang)
        return " ".join(text.split())[:200]
    except Exception:
        return ""
