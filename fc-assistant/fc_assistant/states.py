"""상태 머신에서 사용하는 상태 ID 정의."""

IDLE = "IDLE"
DETECT_WINDOW = "DETECT_WINDOW"
WINDOW_INACTIVE = "WINDOW_INACTIVE"
LOBBY = "LOBBY"
MATCHING = "MATCHING"
IN_GAME = "IN_GAME"
RESULT = "RESULT"
REWARD = "REWARD"
ERROR = "ERROR"
UNKNOWN = "UNKNOWN"
STOPPED = "STOPPED"

STATE_KO = {
    IDLE: "대기",
    DETECT_WINDOW: "게임 창 탐색 중",
    WINDOW_INACTIVE: "게임 창 비활성 (입력 금지 대기)",
    LOBBY: "감독모드 로비",
    MATCHING: "매칭/로딩 중",
    IN_GAME: "경기 진행 중",
    RESULT: "경기 종료 (결과)",
    REWARD: "보상/알림 팝업",
    ERROR: "오류 화면",
    UNKNOWN: "알 수 없는 화면",
    STOPPED: "정지",
}


def state_name(state_id: str) -> str:
    return STATE_KO.get(state_id, state_id)
