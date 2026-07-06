"""이미지 파일 입출력 헬퍼.

Windows에서 한글 경로를 다룰 때 cv2.imread/imwrite가 실패하는 문제가 있어
imencode/imdecode + numpy 파일 입출력으로 우회한다.
"""

from pathlib import Path

import cv2
import numpy as np


def imread(path: Path, grayscale: bool = False) -> np.ndarray | None:
    try:
        buf = np.fromfile(str(path), dtype=np.uint8)
    except OSError:
        return None
    if buf.size == 0:
        return None
    flag = cv2.IMREAD_GRAYSCALE if grayscale else cv2.IMREAD_COLOR
    return cv2.imdecode(buf, flag)


def imwrite(path: Path, img: np.ndarray) -> bool:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(path.suffix or ".png", img)
    if not ok:
        return False
    buf.tofile(str(path))
    return True
