# 🖼️➡️🖱️ image_automation — 이미지 서치 자동화 도구

화면에서 **이미지를 찾아(Image Search)** 그 위치에 **마우스 클릭**을 하거나 **키보드 입력**을 자동으로 수행하는 Python 도구입니다.

미리 캡처해 둔 버튼·아이콘·입력창 이미지를 현재 화면에서 찾아내고(OpenCV 템플릿 매칭), 찾은 좌표에 클릭·더블클릭·드래그를 하거나 문자열/단축키를 입력합니다. 게임 매크로, 반복 작업 자동화, UI 테스트 등에 사용할 수 있습니다.

> ⚠️ 자동화 대상 프로그램/게임/서비스의 약관을 반드시 확인하고, 본인이 권한을 가진 환경에서만 사용하세요.

---

## ⚡ Windows 실행파일(.exe)로 쓰기 — Python 설치 없이

Python을 몰라도 `.exe` 하나로 실행할 수 있습니다. 만드는 방법은 두 가지입니다.

### 방법 A — GitHub Actions가 자동 빌드 (내 PC에 아무것도 설치 안 함) ✅ 추천
1. 이 저장소 GitHub 페이지에서 **Actions** 탭을 엽니다.
2. 왼쪽에서 **Build Windows EXE** 워크플로를 고르고 **Run workflow**(또는 코드가 푸시되면 자동 실행)를 누릅니다.
3. 초록색 체크(✓)가 뜨면 그 실행 결과 페이지 맨 아래 **Artifacts → `image_automation-windows-exe`** 를 다운로드합니다.
4. 압축을 풀면 `image_automation.exe` 가 나옵니다.

### 방법 B — 내 Windows에서 직접 빌드 (Python 3.9+ 필요)
`image_automation` 폴더 안의 **`build_exe.bat` 를 더블클릭**하면 됩니다.
끝나면 `dist\image_automation.exe` 가 생성됩니다.
> 수동으로 하려면: `pip install -r requirements.txt pyinstaller` 후
> `pyinstaller --onefile --name image_automation image_automation.py`

### exe 실행 방법
- **더블클릭** → 대화형 메뉴가 뜹니다(이미지 경로·동작을 물어봄). 가장 쉽습니다.
- **명령 프롬프트(cmd)** 에서 인자와 함께 실행:
  ```bat
  image_automation.exe find  -t button.png
  image_automation.exe click -t button.png -c 0.85 --timeout 5
  image_automation.exe type  -t name_field.png --text "홍길동"
  image_automation.exe run   --config steps.json
  ```

> exe 안에는 Python·라이브러리가 모두 들어 있어 별도 설치가 필요 없습니다.
> (아래 "## 1. 설치"는 Python 스크립트로 직접 돌릴 때만 필요합니다.)

---

## 1. 설치 (Python 스크립트로 직접 실행할 때)

```bash
pip install -r requirements.txt
```

| 패키지 | 용도 | 필수 여부 |
|--------|------|-----------|
| `numpy`, `opencv-python` | 이미지 매칭 | ✅ 필수 |
| `mss` | 빠른 화면 캡처 | 권장(없으면 pyautogui로 대체) |
| `pyautogui` | 마우스/키보드 제어 | 실제 클릭·입력 실행 시 필요 |

> 헤드리스 서버라면 `opencv-python` 대신 `opencv-python-headless` 를 쓰세요.
> 실제 마우스/키보드 동작은 **GUI 데스크톱 세션**에서만 가능합니다.

### 준비물: 템플릿 이미지
찾고자 하는 버튼/아이콘/입력창 부분을 **딱 그 영역만** 잘라서 PNG로 저장하세요.
(운영체제 캡처 도구, 또는 `find --all` 로 좌표를 확인하며 조정)

---

## 2. 빠른 시작 (CLI)

```bash
cd image_automation

# ① 이미지를 찾아 좌표만 확인 (클릭 안 함 — 좌표 튜닝용)
python image_automation.py find -t button.png

# ② 버튼 이미지를 찾아 클릭 (신뢰도 0.85, 최대 5초 대기)
python image_automation.py click -t button.png -c 0.85 --timeout 5

# ③ 더블클릭
python image_automation.py click -t icon.png --clicks 2

# ④ 우클릭 + 중심에서 10px 아래를 클릭
python image_automation.py click -t item.png --button right --offset 0 10

# ⑤ 입력창을 찾아 클릭 후 문자열 입력
python image_automation.py type -t name_field.png --text "ClutchStar"

# ⑥ 입력창을 찾아 클릭 후 엔터
python image_automation.py press -t name_field.png --keys enter

# ⑦ 화면 일부 영역만 탐색(빠름): left,top,width,height
python image_automation.py click -t button.png --region 0,0,960,540

# ⑧ 실제 클릭 없이 시뮬레이션만(좌표 확인)
python image_automation.py click -t button.png --dry-run
```

### 공통 옵션 (find/click/move/type/press)
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-t, --template` | 찾을 이미지 파일 | (필수) |
| `-c, --confidence` | 일치 신뢰도 0~1 | 0.8 |
| `-r, --region` | 탐색 영역 `left,top,width,height` | 전체 화면 |
| `--timeout` | 이미지가 나타날 때까지 대기(초). 0이면 1회만 탐색 | 0 |
| `--interval` | 대기 중 폴링 간격(초) | 0.5 |
| `--no-grayscale` | 흑백 변환 없이 컬러로 매칭 | (흑백) |
| `--dry-run` | 실제 입력 없이 좌표만 출력 | off |

---

## 3. 시나리오 실행 (여러 단계 자동화)

여러 동작을 순서대로 자동 실행하려면 JSON 파일로 정의하고 `run` 하세요.

```bash
python image_automation.py run --config examples/steps.example.json

# 실제 입력 없이 흐름만 확인
python image_automation.py run --config examples/steps.example.json --dry-run
```

### 시나리오 파일 형식
```jsonc
{
  "defaults": {           // 모든 단계 공통 기본값
    "confidence": 0.85,
    "timeout": 10,         // 각 이미지를 최대 몇 초까지 기다릴지
    "grayscale": true,
    "dry_run": false
  },
  "steps": [
    // 이미지를 찾아 클릭
    { "name": "시작", "action": "click", "template": "images/start.png" },

    // 그냥 대기
    { "action": "wait", "seconds": 2 },

    // 입력창을 찾아 클릭 후 문자열 입력
    { "action": "type", "template": "images/name.png", "text": "홍길동" },

    // 찾은 위치에서 키 누르기
    { "action": "press", "template": "images/name.png", "keys": ["enter"] },

    // 있으면 클릭, 없어도 그냥 넘어감
    { "action": "click", "template": "images/popup_close.png", "optional": true },

    // 중심에서 살짝 아래를 더블클릭
    { "action": "click", "template": "images/shoot.png", "clicks": 2, "offset": [0, 10] },

    // 이미지 없이 단축키
    { "action": "hotkey", "keys": ["ctrl", "s"] }
  ]
}
```

### 지원 action
| action | 설명 | 주요 필드 |
|--------|------|-----------|
| `click` | 이미지를 찾아 클릭 | `template`, `button`, `clicks`, `offset` |
| `move`  | 이미지를 찾아 마우스 이동 | `template`, `offset` |
| `type`  | (이미지 클릭 후) 문자열 입력 | `template`(선택), `text`, `interval` |
| `press` | (이미지 클릭 후) 키 누르기 | `template`(선택), `keys` |
| `hotkey`| 단축키 조합 | `keys`(예: `["ctrl","s"]`) |
| `wait`  | 지정 시간 대기 | `seconds` |

- `template` 이 있는 단계는 이미지를 못 찾으면 기본적으로 **중단**합니다.
  `"optional": true` 를 주면 못 찾아도 건너뜁니다.
- `type`/`press`/`hotkey` 는 `template` 을 생략하면 이미지 검색 없이 바로 실행됩니다.

---

## 4. 라이브러리로 사용

```python
from image_automation import locate_on_screen, wait_for, Controller

ctrl = Controller()

# 버튼이 화면에 나타날 때까지 최대 5초 대기 후 클릭
btn = wait_for("button.png", timeout=5, confidence=0.85)
if btn:
    ctrl.click(*btn.center)

# 입력창을 찾아 클릭 후 이름 입력
field = locate_on_screen("name_field.png")
if field:
    ctrl.click(*field.center)
    ctrl.type_text("ClutchStar")
    ctrl.press("enter")
```

주요 API:
- `locate_on_screen(template, region=None, confidence=0.8)` → `Match | None`
- `wait_for(template, timeout=10, interval=0.5, ...)` → `Match | None`
- `locate_in(haystack, needle, confidence=0.8)` → 순수 numpy 매칭(화면 불필요)
- `Controller.click / move / drag / scroll / type_text / press / hotkey`
- `Match.center`, `Match.center_x`, `Match.center_y`, `Match.confidence`

---

## 5. 비상 정지 & 팁

- **비상 정지**: 실행 중 마우스를 **화면 왼쪽 위 모서리**로 빠르게 옮기면 pyautogui FAILSAFE가 동작해 중단됩니다. (또는 터미널에서 `Ctrl+C`)
- **못 찾을 때**: `find -t x.png --all` 로 신뢰도를 확인하고 `-c` 값을 낮추거나(예: 0.7), 템플릿을 더 특징적인 영역으로 다시 캡처하세요.
- **속도**: `--region` 으로 탐색 범위를 좁히면 훨씬 빠릅니다.
- **해상도/DPI**: 템플릿은 실제 실행 화면과 **같은 해상도·배율**에서 캡처하는 것이 가장 정확합니다. (macOS 레티나 등 배율이 다르면 좌표가 어긋날 수 있음)

---

## 6. 테스트

디스플레이 없이도 매칭 로직을 검증할 수 있습니다:

```bash
python tests/test_matching.py
# 또는
pytest tests/
```
