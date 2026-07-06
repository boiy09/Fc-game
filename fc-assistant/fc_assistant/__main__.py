"""실행 진입점: python -m fc_assistant 또는 exe."""

import sys
import time
import traceback


def _crash_handler(exc_type, exc, tb):
    """GUI(콘솔 없음) 실행 중 예외를 파일과 메시지 박스로 남긴다."""
    text = "".join(traceback.format_exception(exc_type, exc, tb))
    try:
        from .paths import logs_dir
        d = logs_dir()
        d.mkdir(parents=True, exist_ok=True)
        (d / f"crash_{time.strftime('%Y%m%d_%H%M%S')}.txt").write_text(
            text, encoding="utf-8")
    except OSError:
        pass
    try:
        import tkinter.messagebox as mb
        mb.showerror("오류", f"프로그램 오류가 발생했습니다.\n\n{exc}")
    except Exception:
        print(text, file=sys.stderr)


def main():
    if "--selftest" in sys.argv:
        from .selftest import run_selftest
        sys.exit(run_selftest())

    sys.excepthook = _crash_handler

    from .window import set_dpi_aware
    set_dpi_aware()

    from .app import run_app
    run_app()


if __name__ == "__main__":
    main()
