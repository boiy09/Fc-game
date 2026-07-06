"""실행 로그 저장 (Logger).

logs/run_YYYYMMDD_HHMMSS.txt  : 사람이 읽는 로그
logs/run_YYYYMMDD_HHMMSS.csv  : 분석용 (시간, 상태, 동작, 상세, 점수)
logs/screenshots/             : 오류/알 수 없는 화면 스크린샷
"""

import csv
import time
from pathlib import Path

import numpy as np

from .imgio import imwrite
from .paths import logs_dir


class RunLogger:
    def __init__(self, base: Path | None = None, enabled: bool = True):
        self.enabled = enabled
        self.dir = logs_dir(base)
        self.shot_dir = self.dir / "screenshots"
        self._txt = None
        self._csv_file = None
        self._csv = None
        if enabled:
            self.dir.mkdir(parents=True, exist_ok=True)
            stamp = time.strftime("%Y%m%d_%H%M%S")
            self._txt = open(self.dir / f"run_{stamp}.txt", "a",
                             encoding="utf-8")
            self._csv_file = open(self.dir / f"run_{stamp}.csv", "a",
                                  newline="", encoding="utf-8-sig")
            self._csv = csv.writer(self._csv_file)
            self._csv.writerow(["time", "state", "action", "detail", "score"])

    def event(self, state: str, action: str, detail: str = "",
              score: float | None = None) -> str:
        ts = time.strftime("%H:%M:%S")
        score_s = f"{score:.3f}" if score is not None else ""
        line = f"[{ts}] [{state}] {action}"
        if detail:
            line += f" | {detail}"
        if score_s:
            line += f" (score={score_s})"
        if self.enabled and self._txt:
            self._txt.write(line + "\n")
            self._txt.flush()
            self._csv.writerow(
                [time.strftime("%Y-%m-%d %H:%M:%S"), state, action, detail,
                 score_s])
            self._csv_file.flush()
        return line

    def screenshot(self, img: np.ndarray | None, tag: str) -> Path | None:
        if img is None:
            return None
        try:
            self.shot_dir.mkdir(parents=True, exist_ok=True)
            path = self.shot_dir / f"{time.strftime('%Y%m%d_%H%M%S')}_{tag}.png"
            if imwrite(path, img):
                return path
        except OSError:
            pass
        return None

    def close(self):
        for f in (self._txt, self._csv_file):
            if f:
                try:
                    f.close()
                except OSError:
                    pass
        self._txt = self._csv_file = self._csv = None
