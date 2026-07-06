"""이미지 탐지 + 상태 판단 (Image Detector / State Machine 판정부).

- OpenCV matchTemplate(TM_CCOEFF_NORMED) + minMaxLoc
- 전체 화면이 아니라 manifest에 정의된 ROI 안에서만 탐색 (속도/오탐 감소)
- 상태는 우선순위 순서로 검사하고, min_evidence 개 이상 일치 + forbid
  템플릿 미일치일 때만 확정한다. 단일 근거로 클릭하지 않는다.
"""

from dataclasses import dataclass, field

import cv2
import numpy as np

from .templates import TemplateManager


@dataclass
class TemplateMatch:
    template: str
    score: float
    center: tuple[int, int]          # 게임 창 내부 좌표
    rect: tuple[int, int, int, int]  # (x, y, w, h) 창 내부 좌표


@dataclass
class StateResult:
    state: dict | None                       # manifest의 상태 정의 (None=UNKNOWN)
    matches: dict[str, TemplateMatch] = field(default_factory=dict)
    scores: dict[str, float] = field(default_factory=dict)

    @property
    def state_id(self) -> str | None:
        return self.state.get("id") if self.state else None

    def summary(self) -> str:
        if not self.scores:
            return ""
        parts = [f"{n} {s:.2f}" for n, s in sorted(
            self.scores.items(), key=lambda kv: -kv[1])[:4]]
        return ", ".join(parts)


class Detector:
    def __init__(self, tm: TemplateManager, confidence: float = 0.85):
        self.tm = tm
        self.confidence = confidence

    # ---------- 단일 템플릿 ----------
    def _threshold(self, name: str) -> float:
        info = self.tm.template_info(name)
        if "threshold" in info:
            return float(info["threshold"])
        return self.confidence

    def _roi_pixels(self, name: str, w: int, h: int) -> tuple[int, int, int, int]:
        roi = self.tm.roi_rect(self.tm.template_info(name).get("roi", "full"))
        x0 = max(0, int(roi[0] * w))
        y0 = max(0, int(roi[1] * h))
        x1 = min(w, int((roi[0] + roi[2]) * w))
        y1 = min(h, int((roi[1] + roi[3]) * h))
        return x0, y0, x1, y1

    def find(self, gray: np.ndarray, name: str) -> tuple[TemplateMatch | None, float]:
        """창 전체 그레이 이미지에서 템플릿 하나를 ROI 안에서 찾는다.

        반환: (일치 결과 또는 None, 최고 점수). 템플릿 파일이 없으면 (None, -1).
        """
        h, w = gray.shape[:2]
        profile_w, _ = self.tm.profile_size()
        scale = w / profile_w if profile_w else 1.0
        tmpl = self.tm.get_scaled(name, scale)
        if tmpl is None:
            return None, -1.0
        x0, y0, x1, y1 = self._roi_pixels(name, w, h)
        crop = gray[y0:y1, x0:x1]
        th, tw = tmpl.shape[:2]
        if crop.shape[0] < th or crop.shape[1] < tw:
            return None, 0.0
        res = cv2.matchTemplate(crop, tmpl, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        score = float(max_val)
        if not np.isfinite(score):
            return None, 0.0
        if score < self._threshold(name):
            return None, score
        mx, my = x0 + max_loc[0], y0 + max_loc[1]
        return TemplateMatch(
            template=name, score=score,
            center=(mx + tw // 2, my + th // 2),
            rect=(mx, my, tw, th),
        ), score

    # ---------- 상태 판정 ----------
    def classify(self, gray: np.ndarray) -> StateResult:
        """현재 프레임의 상태를 결정한다. 확정 불가 시 state=None(UNKNOWN)."""
        cache: dict[str, tuple[TemplateMatch | None, float]] = {}

        def probe(name: str) -> tuple[TemplateMatch | None, float]:
            if name not in cache:
                cache[name] = self.find(gray, name)
            return cache[name]

        for sdef in self.tm.state_defs():
            matched: dict[str, TemplateMatch] = {}
            for name in sdef.get("evidence", []):
                m, _ = probe(name)
                if m:
                    matched[name] = m
            if len(matched) < int(sdef.get("min_evidence", 2)):
                continue
            if any(probe(f)[0] for f in sdef.get("forbid", [])):
                continue
            scores = {n: s for n, (_, s) in cache.items() if s >= 0}
            return StateResult(state=sdef, matches=matched, scores=scores)

        scores = {n: s for n, (_, s) in cache.items() if s >= 0}
        return StateResult(state=None, scores=scores)

    def score_all(self, gray: np.ndarray) -> dict[str, tuple[float, TemplateMatch | None]]:
        """템플릿 관리 화면의 매칭 테스트용: 모든 템플릿 점수."""
        out = {}
        for name in self.tm.template_names():
            m, s = self.find(gray, name)
            out[name] = (s, m)
        return out


def to_gray(bgr: np.ndarray) -> np.ndarray:
    if bgr.ndim == 2:
        return bgr
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
