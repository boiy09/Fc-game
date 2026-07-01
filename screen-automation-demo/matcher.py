"""
[2단계] 이미지 매칭
------------------
미리 잘라둔 템플릿 이미지를 화면 안에서 찾는다.
- match_one       : 가장 잘 맞는 한 곳
- match_all       : 임계값을 넘는 여러 곳 (간단한 중복 제거 포함)
- match_multiscale: 크기를 바꿔가며 찾기 (해상도/UI 배율이 다를 때)

핵심은 OpenCV 의 cv2.matchTemplate + cv2.minMaxLoc.
유사도 척도는 TM_CCOEFF_NORMED (0~1, 1에 가까울수록 잘 맞음).
"""
import cv2
import numpy as np


def match_one(screen, template, threshold=0.85):
    """가장 잘 맞는 한 지점. 반환: (center(x,y), score) 또는 (None, best_score)."""
    result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)
    if max_val >= threshold:
        h, w = template.shape[:2]
        center = (max_loc[0] + w // 2, max_loc[1] + h // 2)
        return center, float(max_val)
    return None, float(max_val)


def match_all(screen, template, threshold=0.85):
    """임계값을 넘는 모든 지점. 겹치는 검출은 간단히 억제. 반환: [(center, score), ...]."""
    result = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
    h, w = template.shape[:2]
    ys, xs = np.where(result >= threshold)

    # 점수 높은 순으로 정렬해서, 좋은 것부터 채택
    candidates = sorted(
        ((float(result[y, x]), int(x), int(y)) for x, y in zip(xs, ys)),
        key=lambda t: t[0], reverse=True,
    )

    matches = []
    for score, x, y in candidates:
        center = (x + w // 2, y + h // 2)
        # 이미 채택된 것들과 반 템플릿 이상 떨어져 있으면 새 검출로 인정 (간이 NMS)
        too_close = any(
            abs(center[0] - c[0]) <= w // 2 and abs(center[1] - c[1]) <= h // 2
            for c, _ in matches
        )
        if not too_close:
            matches.append((center, score))
    return matches


def match_multiscale(screen, template, threshold=0.85,
                     scales=np.linspace(0.6, 1.4, 9)):
    """템플릿 크기를 바꿔가며 최고 매칭을 찾는다.
    반환: (center, score, scale) 또는 None.
    """
    best = None
    th, tw = template.shape[:2]
    for scale in scales:
        w, h = int(tw * scale), int(th * scale)
        if w < 8 or h < 8 or w > screen.shape[1] or h > screen.shape[0]:
            continue
        resized = cv2.resize(template, (w, h))
        result = cv2.matchTemplate(screen, resized, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(result)
        if best is None or max_val > best[1]:
            center = (max_loc[0] + w // 2, max_loc[1] + h // 2)
            best = (center, float(max_val), float(scale))
    if best and best[1] >= threshold:
        return best
    return None
