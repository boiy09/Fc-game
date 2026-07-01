# 이미지 인식 화면 자동화 — 학습용 툴킷

화면을 캡처해서 → 미리 잘라둔 이미지를 찾고 → 판단해서 → 마우스/키보드 입력을 내는,
**이미지 인식 자동화의 핵심 4단계**를 손으로 익히기 위한 범용 예제입니다.

특정 프로그램에 묶여 있지 않고 **어떤 데스크톱 앱에서든** 돌아갑니다.
그대로 테스트 자동화·RPA(반복 업무 자동화) 같은 곳에 쓰이는 기술이에요.

## 4단계와 파일 구성

| 단계 | 하는 일 | 파일 | 핵심 도구 |
|------|---------|------|-----------|
| 1. 캡처 | 화면/영역 스크린샷 | `capture.py` | `mss` |
| 2. 매칭 | 화면에서 템플릿 찾기 | `matcher.py` | OpenCV `matchTemplate` |
| (보조) 텍스트 | 화면 글자/숫자 읽기 | `ocr.py` | `pytesseract` |
| 3+4. 판단·입력 | 찾으면 클릭 / 나타날 때까지 대기 | `actions.py` | `pyautogui` |
| 도우미 | 드래그로 템플릿 이미지 만들기 | `snip.py` | OpenCV `selectROI` |
| 데모 | 전체 파이프라인 실행 | `demo.py` | — |

## 설치

```bash
pip install -r requirements.txt
```

OCR(`ocr.py`)을 쓰려면 Tesseract 엔진 본체도 설치해야 합니다.

```bash
# Ubuntu/Debian
sudo apt install tesseract-ocr
# macOS
brew install tesseract
# Windows: https://github.com/UB-Mannheim/tesseract 에서 설치
```

## 빠른 시작

```bash
# 1) 찾을 이미지를 만든다 (원하는 버튼/아이콘을 드래그해서 template.png 로 저장)
python snip.py

# 2) 실시간으로 찾아본다 (탐지만, 클릭 안 함 — 안전)
python demo.py

# 3) 익숙해지면 찾았을 때 클릭까지
python demo.py --click
```

> 처음엔 **계산기·메모장·웹페이지 버튼** 같은 본인 앱으로 연습하세요.
> `--click` 모드에서 멈추려면 마우스를 화면 **좌상단 맨 끝**으로 밀면 즉시 정지합니다(pyautogui FAILSAFE).

## 코드로 바로 쓰기

```python
import cv2
from actions import find_and_click, wait_for_image

btn = cv2.imread("template.png")

# 지금 보이면 클릭
find_and_click(btn, threshold=0.9)

# 나타날 때까지 최대 10초 기다렸다가 좌표 받기
pos = wait_for_image(btn, timeout=10)
if pos:
    print("등장!", pos)
```

## 튜닝 포인트 (여기가 실력)

- **threshold(임계값)**: 너무 높으면 못 찾고, 너무 낮으면 엉뚱한 걸 클릭. `demo.py`가 찍어주는
  유사도 로그를 보면서 보통 0.8~0.95 사이로 조정합니다.
- **해상도/배율**: 템플릿은 캡처 당시 크기에 묶입니다. 화면 크기나 UI 배율이 바뀌면
  못 찾으므로 `matcher.match_multiscale` (크기 바꿔가며 매칭)을 쓰세요.
- **글자·숫자**: 그림이 아니라 텍스트라면 템플릿 매칭보다 `ocr.read_text` / `read_number`가 정확합니다.
  다크 UI(어두운 배경 + 밝은 글자)면 `invert=True`.
- **영역 지정**: 전체 화면 대신 `region=(left, top, w, h)`로 좁히면 훨씬 빠르고 오탐도 줄어듭니다.

## 더 확장해볼 것

- `match_all` 로 같은 아이콘 여러 개 동시에 찾기
- OCR + 매칭을 조합한 "특정 숫자가 될 때까지 대기" 같은 조건 로직
- 특징점 매칭(ORB/SIFT)으로 회전·크기 변화에 강하게 만들기

## 실행파일(exe)로 만들기 — Windows

Python 설치 없이 더블클릭으로 쓰고 싶다면 `app.py`(통합 런처)를 exe 로 빌드합니다.
메뉴에서 `1) 템플릿 만들기 → 2) 탐지 → 3) 탐지+클릭` 을 고르는 콘솔 프로그램이에요.

**방법 A. 빌드 없이 받기 (GitHub Actions)**
브랜치에 push 되면 `Build Windows EXE` 워크플로가 윈도우에서 자동 빌드합니다.
GitHub → **Actions** 탭 → 최신 실행 → 하단 **Artifacts** 의
`screen-automation-exe` 를 내려받아 압축을 풀면 `screen-automation.exe` 가 있습니다.

**방법 B. 내 PC에서 직접 빌드** (Python 필요)
```bat
build.bat        REM 더블클릭 → dist\screen-automation.exe 생성
```

**방법 C. exe 없이 바로 실행** (Python 필요)
```bat
run.bat          REM 최초 1회 의존성 설치 후 app.py 실행
```

> 리눅스/CI 에서 만든 exe 는 윈도우 전용입니다. macOS/Linux 사용자는 `run.bat` 대신
> `python app.py` 로 실행하세요.

---

### 참고

이 코드는 자동화 **기술 학습용** 범용 예제입니다.
온라인 게임 등 서비스는 대부분 약관에서 매크로/자동화 프로그램 사용을 금지하며
계정 제재 사유가 될 수 있으니, 연습은 본인 앱이나 테스트 대상에서 하세요.
