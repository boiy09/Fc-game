"""Tkinter GUI.

탭 구성:
  [제어판]      상태 표시, 카운터, 시작/일시정지/정지, 실시간 로그
  [템플릿 관리] 템플릿 목록/누락 표시, 게임 화면 캡처, 매칭 테스트,
               드래그로 템플릿 등록(교체 시 자동 백업)
  [설정]       해상도 프로필, 민감도, 반복 횟수, 오류 시 동작 등
"""

import os
import queue
import subprocess
import sys
import time
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext, ttk

import cv2
import numpy as np
from PIL import Image, ImageTk

from . import APP_NAME, __version__
from . import states as st
from .capture import CaptureManager
from .config import load_config, save_config
from .detector import Detector, to_gray
from .engine import AutomationEngine
from .paths import app_base_dir, logs_dir, templates_dir
from .safety import HotkeyWatcher
from .templates import TemplateManager, ensure_structure
from .window import WindowManager

ON_ERROR_LABELS = {"stop": "즉시 정지", "notify": "로그만 남기고 대기"}
ON_ERROR_VALUES = {v: k for k, v in ON_ERROR_LABELS.items()}


def open_folder(path):
    path = str(path)
    os.makedirs(path, exist_ok=True)
    if sys.platform == "win32":
        os.startfile(path)  # noqa: S606
    else:
        subprocess.Popen(["xdg-open", path])


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.base = app_base_dir()
        ensure_structure(self.base)
        self.cfg = load_config(self.base)

        self.title(f"{APP_NAME} v{__version__}")
        self.geometry("820x640")
        self.minsize(720, 560)

        self.events: queue.Queue = queue.Queue()
        self.engine: AutomationEngine | None = None
        self.test_img: np.ndarray | None = None  # 템플릿 관리용 캡처(BGR)

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=6, pady=6)
        self.tab_main = ttk.Frame(nb)
        self.tab_tpl = ttk.Frame(nb)
        self.tab_cfg = ttk.Frame(nb)
        nb.add(self.tab_main, text=" 제어판 ")
        nb.add(self.tab_tpl, text=" 템플릿 관리 ")
        nb.add(self.tab_cfg, text=" 설정 ")

        self._build_main_tab()
        self._build_template_tab()
        self._build_config_tab()

        # 전역 단축키 (Windows). 다른 OS에서는 창 포커스 시에만 동작.
        self.hotkeys = HotkeyWatcher({
            self.cfg["hotkey_start"]: lambda: self.events.put(
                {"type": "hotkey", "key": "start"}),
            self.cfg["hotkey_stop"]: lambda: self.events.put(
                {"type": "hotkey", "key": "stop"}),
        })
        self.hotkeys.start()
        try:  # 창 포커스 시 동작하는 보조 바인딩 (키 이름이 잘못돼도 무시)
            self.bind(f"<{self.cfg['hotkey_start']}>",
                      lambda e: self.start_engine())
            self.bind(f"<{self.cfg['hotkey_stop']}>",
                      lambda e: self.stop_engine())
        except tk.TclError:
            pass

        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.after(100, self._poll_events)
        self._append_log(
            f"준비 완료. 템플릿 폴더: {templates_dir(self.base)}")
        self._append_log(
            "먼저 [템플릿 관리] 탭에서 게임 화면을 캡처해 버튼/상태 템플릿을 등록하세요.")

    # ================= 제어판 =================
    def _build_main_tab(self):
        top = ttk.Frame(self.tab_main)
        top.pack(fill="x", padx=10, pady=8)

        self.var_prog = tk.StringVar(value="대기")
        self.var_state = tk.StringVar(value="-")
        self.var_detail = tk.StringVar(value="")

        box = ttk.LabelFrame(top, text="프로그램 상태")
        box.pack(side="left", fill="both", expand=True)
        self.lbl_prog = ttk.Label(box, textvariable=self.var_prog,
                                  font=("", 16, "bold"))
        self.lbl_prog.pack(anchor="w", padx=10, pady=(6, 0))
        ttk.Label(box, text="현재 인식 상태").pack(anchor="w", padx=10,
                                             pady=(6, 0))
        ttk.Label(box, textvariable=self.var_state,
                  font=("", 12, "bold")).pack(anchor="w", padx=10)
        ttk.Label(box, textvariable=self.var_detail,
                  foreground="#666").pack(anchor="w", padx=10, pady=(0, 6))

        cnt = ttk.LabelFrame(top, text="카운터")
        cnt.pack(side="left", fill="y", padx=(8, 0))
        self.var_loops = tk.StringVar(value="반복: 0 / 0")
        self.var_clicks = tk.StringVar(value="클릭: 0")
        self.var_errors = tk.StringVar(value="오류: 0")
        for v in (self.var_loops, self.var_clicks, self.var_errors):
            ttk.Label(cnt, textvariable=v).pack(anchor="w", padx=12, pady=2)

        btns = ttk.Frame(self.tab_main)
        btns.pack(fill="x", padx=10, pady=4)
        self.btn_start = ttk.Button(
            btns, text=f"▶ 시작 ({self.cfg['hotkey_start']})",
            command=self.start_engine)
        self.btn_pause = ttk.Button(btns, text="⏸ 일시정지",
                                    command=self.pause_engine,
                                    state="disabled")
        self.btn_stop = ttk.Button(
            btns, text=f"⏹ 정지 ({self.cfg['hotkey_stop']})",
            command=self.stop_engine, state="disabled")
        self.btn_start.pack(side="left", padx=2)
        self.btn_pause.pack(side="left", padx=2)
        self.btn_stop.pack(side="left", padx=2)
        ttk.Button(btns, text="로그 폴더",
                   command=lambda: open_folder(logs_dir(self.base))
                   ).pack(side="right", padx=2)
        ttk.Button(btns, text="템플릿 폴더",
                   command=lambda: open_folder(templates_dir(self.base))
                   ).pack(side="right", padx=2)

        note = ("안전 안내: 게임 창이 활성 상태일 때만 입력합니다. "
                "마우스를 화면 왼쪽 위 모서리로 밀면 즉시 중단됩니다(FAILSAFE). "
                "알 수 없는 화면이 지속되면 자동 정지합니다.")
        ttk.Label(self.tab_main, text=note, foreground="#666",
                  wraplength=760, justify="left").pack(fill="x", padx=12)

        logf = ttk.LabelFrame(self.tab_main, text="실행 로그")
        logf.pack(fill="both", expand=True, padx=10, pady=8)
        self.txt_log = scrolledtext.ScrolledText(
            logf, height=14, state="disabled", font=("Consolas", 9))
        self.txt_log.pack(fill="both", expand=True, padx=4, pady=4)

    def _append_log(self, line: str):
        self.txt_log.configure(state="normal")
        self.txt_log.insert("end", line + "\n")
        if int(self.txt_log.index("end-1c").split(".")[0]) > 2000:
            self.txt_log.delete("1.0", "200.0")
        self.txt_log.see("end")
        self.txt_log.configure(state="disabled")

    # ================= 엔진 제어 =================
    def _collect_config(self) -> dict:
        cfg = dict(self.cfg)
        cfg["template_version"] = self.var_version.get() or cfg["template_version"]
        cfg["resolution_profile"] = self.var_resolution.get() or "auto"
        cfg["confidence"] = round(float(self.var_conf.get()), 2)
        cfg["max_loops"] = int(self.var_max_loops.get())
        cfg["scan_interval_ms"] = int(self.var_interval.get())
        cfg["unknown_timeout_sec"] = float(self.var_unknown.get())
        cfg["max_runtime_min"] = int(self.var_runtime.get())
        cfg["post_click_wait_sec"] = float(self.var_postclick.get())
        cfg["on_error"] = ON_ERROR_VALUES.get(self.var_onerror.get(), "stop")
        cfg["logging_enabled"] = bool(self.var_logging.get())
        cfg["save_error_screenshot"] = bool(self.var_shot.get())
        cfg["ocr_enabled"] = bool(self.var_ocr.get())
        kw = [s.strip() for s in self.var_keywords.get().split(",") if s.strip()]
        if kw:
            cfg["window_title_keywords"] = kw
        return cfg

    def save_settings(self):
        self.cfg = self._collect_config()
        save_config(self.cfg, self.base)
        self._append_log("설정 저장 완료.")

    def start_engine(self):
        if self.engine and self.engine.is_alive():
            if self.engine.paused:
                self.engine.toggle_pause()
                self.var_prog.set("실행 중")
                self.btn_pause.configure(text="⏸ 일시정지")
            return
        self.cfg = self._collect_config()
        save_config(self.cfg, self.base)

        tm = TemplateManager(self.base, self.cfg["template_version"])
        if self.cfg["resolution_profile"] != "auto":
            tm.select_resolution(self.cfg["resolution_profile"])
            missing = tm.missing_templates()
            if missing and not messagebox.askyesno(
                    "템플릿 누락",
                    "다음 템플릿이 아직 등록되지 않았습니다:\n\n"
                    + ", ".join(missing)
                    + "\n\n해당 상태는 인식할 수 없어 안전 정지가 잦을 수 있습니다."
                      "\n그래도 시작할까요?"):
                return

        self.engine = AutomationEngine(self.cfg, self.base,
                                       emit=self.events.put)
        self.engine.start()
        self.var_prog.set("실행 중")
        self.btn_start.configure(state="disabled")
        self.btn_pause.configure(state="normal", text="⏸ 일시정지")
        self.btn_stop.configure(state="normal")

    def pause_engine(self):
        if self.engine and self.engine.is_alive():
            paused = self.engine.toggle_pause()
            self.var_prog.set("일시정지" if paused else "실행 중")
            self.btn_pause.configure(
                text="▶ 재개" if paused else "⏸ 일시정지")

    def stop_engine(self):
        if self.engine and self.engine.is_alive():
            self.engine.request_stop("사용자 정지")

    def _on_engine_stopped(self, reason: str):
        self.var_prog.set("정지")
        self.var_state.set(st.state_name(st.STOPPED))
        self.btn_start.configure(state="normal")
        self.btn_pause.configure(state="disabled", text="⏸ 일시정지")
        self.btn_stop.configure(state="disabled")
        self._append_log(f"== 정지: {reason} ==")

    # ================= 이벤트 폴링 =================
    def _poll_events(self):
        try:
            while True:
                ev = self.events.get_nowait()
                et = ev.get("type")
                if et == "log":
                    self._append_log(ev["line"])
                elif et == "state":
                    self.var_state.set(ev["name"])
                    self.var_detail.set(ev.get("detail", ""))
                elif et == "counters":
                    self.var_loops.set(f"반복: {ev['loops']} / {ev['max']}")
                    self.var_clicks.set(f"클릭: {ev['clicks']}")
                    self.var_errors.set(f"오류: {ev['errors']}")
                elif et == "stopped":
                    self._on_engine_stopped(ev.get("reason", ""))
                elif et == "hotkey":
                    if ev["key"] == "start":
                        self.start_engine()
                    else:
                        self.stop_engine()
        except queue.Empty:
            pass
        self.after(100, self._poll_events)

    # ================= 템플릿 관리 =================
    def _build_template_tab(self):
        info = ttk.Frame(self.tab_tpl)
        info.pack(fill="x", padx=10, pady=6)
        self.var_test_info = tk.StringVar(
            value="테스트 캡처 없음 - 게임 화면을 캡처하거나 이미지를 여세요.")
        ttk.Label(info, textvariable=self.var_test_info).pack(side="left")
        self.var_classify = tk.StringVar(value="")
        ttk.Label(info, textvariable=self.var_classify,
                  font=("", 10, "bold"), foreground="#0a6").pack(side="right")

        btns = ttk.Frame(self.tab_tpl)
        btns.pack(fill="x", padx=10, pady=2)
        ttk.Button(btns, text="게임 화면 캡처",
                   command=self.capture_game_screen).pack(side="left", padx=2)
        ttk.Button(btns, text="이미지 파일 열기",
                   command=self.open_test_image).pack(side="left", padx=2)
        ttk.Button(btns, text="매칭 테스트",
                   command=self.run_match_test).pack(side="left", padx=2)
        ttk.Button(btns, text="영역 선택 → 템플릿 등록",
                   command=self.register_template).pack(side="left", padx=8)
        ttk.Button(btns, text="새로고침",
                   command=self.refresh_template_tree).pack(side="right", padx=2)
        ttk.Button(btns, text="백업 폴더",
                   command=self._open_backup_dir).pack(side="right", padx=2)

        cols = ("desc", "roi", "file", "score", "verdict")
        self.tree = ttk.Treeview(self.tab_tpl, columns=cols, show="tree headings",
                                 height=14)
        self.tree.heading("#0", text="템플릿")
        self.tree.column("#0", width=150, anchor="w")
        for cid, label, width in (
                ("desc", "설명", 220), ("roi", "ROI", 100),
                ("file", "파일", 60), ("score", "매칭 점수", 90),
                ("verdict", "판정", 90)):
            self.tree.heading(cid, text=label)
            self.tree.column(cid, width=width, anchor="center")
        self.tree.column("desc", anchor="w")
        self.tree.pack(fill="both", expand=True, padx=10, pady=6)

        tip = ("사용 순서: ① 게임에서 원하는 화면을 띄운 뒤 [게임 화면 캡처] "
               "② 목록에서 등록할 템플릿을 선택하고 [영역 선택 → 템플릿 등록] "
               "③ 버튼/UI 영역만 드래그해 저장 ④ [매칭 테스트]로 인식률 확인. "
               "교체 시 이전 이미지는 _backup 폴더에 자동 보관됩니다.")
        ttk.Label(self.tab_tpl, text=tip, foreground="#666", wraplength=760,
                  justify="left").pack(fill="x", padx=12, pady=(0, 8))
        self.refresh_template_tree()

    def _tpl_manager(self) -> TemplateManager:
        tm = TemplateManager(self.base, self.var_version.get()
                             if hasattr(self, "var_version") else None)
        if self.test_img is not None:
            h, w = self.test_img.shape[:2]
            tm.select_resolution("auto", w, h)
        else:
            profile = (self.var_resolution.get()
                       if hasattr(self, "var_resolution") else "auto")
            tm.select_resolution(profile if profile != "auto" else "1920x1080")
        return tm

    def refresh_template_tree(self, scores: dict | None = None):
        tm = self._tpl_manager()
        self.tree.delete(*self.tree.get_children())
        thr_default = float(self.var_conf.get()) if hasattr(self, "var_conf") \
            else float(self.cfg["confidence"])
        for name in tm.template_names():
            info = tm.template_info(name)
            exists = tm.template_path(name).exists()
            score_s, verdict = "-", "-"
            if scores and name in scores:
                s, m = scores[name]
                if s < 0:
                    score_s, verdict = "파일 없음", "등록 필요"
                else:
                    score_s = f"{s:.3f}"
                    thr = float(info.get("threshold", thr_default))
                    verdict = "일치 ✔" if (m is not None and s >= thr) else "불일치"
            elif not exists:
                verdict = "등록 필요"
            self.tree.insert(
                "", "end", iid=name, text=name,
                values=(info.get("desc", ""), info.get("roi", "full"),
                        "있음" if exists else "없음", score_s, verdict))

    def capture_game_screen(self):
        wm = WindowManager(self.cfg["window_title_keywords"])
        win = wm.find()
        if win is None:
            messagebox.showwarning(
                "게임 창 없음",
                "FC온라인 창을 찾지 못했습니다.\n"
                "게임을 실행한 뒤 다시 시도하거나, 스크린샷 파일을 "
                "[이미지 파일 열기]로 불러오세요.")
            return
        self.withdraw()
        self.update_idletasks()
        time.sleep(0.9)  # 본 창이 사라질 시간
        try:
            cap = CaptureManager()
            self.test_img = cap.grab(win.region())
            cap.close()
        finally:
            self.deiconify()
        h, w = self.test_img.shape[:2]
        self.var_test_info.set(f"게임 캡처 완료: {w}x{h} ({win.title})")
        self.var_classify.set("")
        self.refresh_template_tree()

    def open_test_image(self):
        path = filedialog.askopenfilename(
            title="게임 스크린샷 선택",
            filetypes=[("이미지", "*.png *.jpg *.jpeg *.bmp"), ("모두", "*.*")])
        if not path:
            return
        from .imgio import imread
        img = imread(path)
        if img is None:
            messagebox.showerror("오류", "이미지를 읽을 수 없습니다.")
            return
        self.test_img = img
        h, w = img.shape[:2]
        self.var_test_info.set(f"파일 로드 완료: {w}x{h} ({os.path.basename(path)})")
        self.var_classify.set("")
        self.refresh_template_tree()

    def run_match_test(self):
        if self.test_img is None:
            messagebox.showinfo("안내", "먼저 게임 화면을 캡처하거나 이미지를 여세요.")
            return
        tm = self._tpl_manager()
        conf = float(self.var_conf.get())
        det = Detector(tm, confidence=conf)
        gray = to_gray(self.test_img)
        scores = det.score_all(gray)
        self.refresh_template_tree(scores)
        result = det.classify(gray)
        if result.state:
            self.var_classify.set(
                f"이 화면 인식 결과: {st.state_name(result.state_id)}"
                f" ({result.state_id})")
        else:
            self.var_classify.set("이 화면 인식 결과: 알 수 없음 (UNKNOWN)")

    def register_template(self):
        if self.test_img is None:
            messagebox.showinfo("안내", "먼저 게임 화면을 캡처하거나 이미지를 여세요.")
            return
        selected = self.tree.selection()
        default_name = selected[0] if selected else ""
        RegionSelectDialog(self, self.test_img,
                           lambda box: self._save_region(box, default_name))

    def _save_region(self, box: tuple[int, int, int, int], default_name: str):
        x1, y1, x2, y2 = box
        if x2 - x1 < 8 or y2 - y1 < 8:
            messagebox.showwarning("안내", "선택 영역이 너무 작습니다.")
            return
        tm = self._tpl_manager()
        dlg = NameDialog(self, tm.template_names(), default_name)
        self.wait_window(dlg)
        name = dlg.result
        if not name:
            return
        crop = self.test_img[y1:y2, x1:x2].copy()
        h, w = self.test_img.shape[:2]
        path = tm.save_template(name, crop, resolution=f"{w}x{h}")
        self._append_log(f"템플릿 저장: {path}")
        messagebox.showinfo("저장 완료",
                            f"{name} 템플릿을 저장했습니다.\n{path}")
        self.refresh_template_tree()

    def _open_backup_dir(self):
        tm = self._tpl_manager()
        open_folder(tm.version_dir() / "_backup")

    # ================= 설정 =================
    def _build_config_tab(self):
        frm = ttk.Frame(self.tab_cfg)
        frm.pack(fill="x", padx=14, pady=10)
        row = 0

        def add_row(label, widget):
            nonlocal row
            ttk.Label(frm, text=label).grid(row=row, column=0, sticky="w",
                                            pady=4, padx=(0, 10))
            widget.grid(row=row, column=1, sticky="w")
            row += 1

        tm = TemplateManager(self.base)
        self.var_version = tk.StringVar(value=self.cfg["template_version"])
        cb_ver = ttk.Combobox(frm, textvariable=self.var_version, width=24,
                              values=tm.list_versions() or
                              [self.cfg["template_version"]])
        add_row("템플릿 버전", cb_ver)

        self.var_resolution = tk.StringVar(value=self.cfg["resolution_profile"])
        cb_res = ttk.Combobox(frm, textvariable=self.var_resolution, width=24,
                              values=["auto"] + tm.list_resolutions())
        add_row("해상도 프로필 (auto=창 크기 자동)", cb_res)

        self.var_conf = tk.DoubleVar(value=float(self.cfg["confidence"]))
        conf_frame = ttk.Frame(frm)
        self.lbl_conf = ttk.Label(conf_frame, text=f"{self.var_conf.get():.2f}")
        scale = ttk.Scale(conf_frame, from_=0.60, to=0.99,
                          variable=self.var_conf, length=200,
                          command=lambda v: self.lbl_conf.configure(
                              text=f"{float(v):.2f}"))
        scale.pack(side="left")
        self.lbl_conf.pack(side="left", padx=8)
        add_row("인식 민감도 (confidence)", conf_frame)

        self.var_max_loops = tk.IntVar(value=int(self.cfg["max_loops"]))
        add_row("반복 횟수 제한 (경기 수)",
                ttk.Spinbox(frm, from_=1, to=500, width=8,
                            textvariable=self.var_max_loops))

        self.var_runtime = tk.IntVar(value=int(self.cfg["max_runtime_min"]))
        add_row("최대 실행 시간 (분)",
                ttk.Spinbox(frm, from_=5, to=240, width=8,
                            textvariable=self.var_runtime))

        self.var_interval = tk.IntVar(value=int(self.cfg["scan_interval_ms"]))
        add_row("화면 검사 주기 (ms)",
                ttk.Spinbox(frm, from_=100, to=3000, increment=100, width=8,
                            textvariable=self.var_interval))

        self.var_unknown = tk.DoubleVar(
            value=float(self.cfg["unknown_timeout_sec"]))
        add_row("알 수 없는 화면 정지 시간 (초)",
                ttk.Spinbox(frm, from_=3, to=60, width=8,
                            textvariable=self.var_unknown))

        self.var_postclick = tk.DoubleVar(
            value=float(self.cfg["post_click_wait_sec"]))
        add_row("클릭 후 대기 (초)",
                ttk.Spinbox(frm, from_=0.5, to=5.0, increment=0.5, width=8,
                            textvariable=self.var_postclick))

        self.var_onerror = tk.StringVar(
            value=ON_ERROR_LABELS.get(self.cfg["on_error"], "즉시 정지"))
        add_row("오류 화면 감지 시",
                ttk.Combobox(frm, textvariable=self.var_onerror, width=22,
                             state="readonly",
                             values=list(ON_ERROR_LABELS.values())))

        self.var_keywords = tk.StringVar(
            value=", ".join(self.cfg["window_title_keywords"]))
        add_row("게임 창 제목 키워드 (쉼표 구분)",
                ttk.Entry(frm, textvariable=self.var_keywords, width=40))

        self.var_logging = tk.BooleanVar(value=bool(self.cfg["logging_enabled"]))
        self.var_shot = tk.BooleanVar(
            value=bool(self.cfg["save_error_screenshot"]))
        self.var_ocr = tk.BooleanVar(value=bool(self.cfg["ocr_enabled"]))
        checks = ttk.Frame(frm)
        ttk.Checkbutton(checks, text="로그 저장",
                        variable=self.var_logging).pack(side="left", padx=(0, 10))
        ttk.Checkbutton(checks, text="오류 스크린샷 저장",
                        variable=self.var_shot).pack(side="left", padx=(0, 10))
        ttk.Checkbutton(checks, text="OCR 보조 (pytesseract 필요)",
                        variable=self.var_ocr).pack(side="left")
        add_row("옵션", checks)

        ttk.Button(frm, text="설정 저장", command=self.save_settings
                   ).grid(row=row, column=0, pady=14, sticky="w")
        ttk.Label(frm, text=f"단축키: 시작 {self.cfg['hotkey_start']} / "
                            f"정지 {self.cfg['hotkey_stop']} "
                            "(config/user_config.json에서 변경)",
                  foreground="#666").grid(row=row, column=1, sticky="w")

    # ================= 종료 =================
    def on_close(self):
        if self.engine and self.engine.is_alive():
            self.engine.request_stop("프로그램 종료")
            self.engine.join(timeout=2.0)
        self.hotkeys.stop()
        self.destroy()


class RegionSelectDialog(tk.Toplevel):
    """캡처 이미지 위에서 드래그로 영역을 선택하는 다이얼로그."""

    MAX_W, MAX_H = 1080, 620

    def __init__(self, master, bgr_img: np.ndarray, on_done):
        super().__init__(master)
        self.title("템플릿 영역 선택 - 버튼/UI 영역만 드래그하세요")
        self.on_done = on_done
        self.img = bgr_img
        h, w = bgr_img.shape[:2]
        self.scale = min(self.MAX_W / w, self.MAX_H / h, 1.0)
        disp_w, disp_h = int(w * self.scale), int(h * self.scale)

        rgb = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb).resize((disp_w, disp_h), Image.LANCZOS)
        self.photo = ImageTk.PhotoImage(pil)

        self.canvas = tk.Canvas(self, width=disp_w, height=disp_h,
                                cursor="crosshair", highlightthickness=0)
        self.canvas.pack(padx=8, pady=8)
        self.canvas.create_image(0, 0, image=self.photo, anchor="nw")
        self.rect_id = None
        self.start = None
        self.box = None

        bar = ttk.Frame(self)
        bar.pack(fill="x", padx=8, pady=(0, 8))
        self.var_info = tk.StringVar(value="드래그로 영역을 선택하세요.")
        ttk.Label(bar, textvariable=self.var_info).pack(side="left")
        self.btn_ok = ttk.Button(bar, text="이 영역으로 저장",
                                 command=self._done, state="disabled")
        self.btn_ok.pack(side="right", padx=4)
        ttk.Button(bar, text="취소", command=self.destroy).pack(side="right")

        self.canvas.bind("<ButtonPress-1>", self._press)
        self.canvas.bind("<B1-Motion>", self._drag)
        self.canvas.bind("<ButtonRelease-1>", self._release)
        self.transient(master)
        self.grab_set()

    def _press(self, e):
        self.start = (e.x, e.y)
        if self.rect_id:
            self.canvas.delete(self.rect_id)
        self.rect_id = self.canvas.create_rectangle(
            e.x, e.y, e.x, e.y, outline="#ff3333", width=2)

    def _drag(self, e):
        if self.start and self.rect_id:
            self.canvas.coords(self.rect_id, self.start[0], self.start[1],
                               e.x, e.y)

    def _release(self, e):
        if not self.start:
            return
        x1 = int(min(self.start[0], e.x) / self.scale)
        y1 = int(min(self.start[1], e.y) / self.scale)
        x2 = int(max(self.start[0], e.x) / self.scale)
        y2 = int(max(self.start[1], e.y) / self.scale)
        h, w = self.img.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        self.box = (x1, y1, x2, y2)
        self.var_info.set(
            f"선택: ({x1},{y1}) ~ ({x2},{y2})  크기 {x2 - x1}x{y2 - y1}px")
        self.btn_ok.configure(
            state="normal" if (x2 - x1 >= 8 and y2 - y1 >= 8) else "disabled")

    def _done(self):
        box = self.box
        self.destroy()
        if box:
            self.on_done(box)


class NameDialog(tk.Toplevel):
    """저장할 템플릿 이름 선택/입력."""

    def __init__(self, master, names: list[str], default: str = ""):
        super().__init__(master)
        self.title("템플릿 이름")
        self.result: str | None = None
        ttk.Label(self, text="템플릿 이름을 선택하거나 입력하세요:"
                  ).pack(padx=12, pady=(12, 4), anchor="w")
        self.var = tk.StringVar(value=default or (names[0] if names else ""))
        cb = ttk.Combobox(self, textvariable=self.var, values=names, width=32)
        cb.pack(padx=12, pady=4)
        bar = ttk.Frame(self)
        bar.pack(pady=10)
        ttk.Button(bar, text="저장", command=self._ok).pack(side="left", padx=4)
        ttk.Button(bar, text="취소", command=self.destroy).pack(side="left")
        cb.focus_set()
        self.bind("<Return>", lambda e: self._ok())
        self.transient(master)
        self.grab_set()

    def _ok(self):
        name = self.var.get().strip()
        if not name:
            return
        # 파일명으로 쓸 수 없는 문자 제거
        self.result = "".join(c for c in name if c.isalnum() or c in "_-")
        self.destroy()


def run_app():
    app = App()
    app.mainloop()
