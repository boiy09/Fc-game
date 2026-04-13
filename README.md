# Clutch Star MVP

## 바로 플레이(배포 링크)
GitHub Pages 배포가 완료되면 아래 형식으로 접속:

- `https://<github-username>.github.io/<repo-name>/`

## 로컬 실행
1. 저장소 폴더에서 서버 실행
   - `python -m http.server 8000`
2. 브라우저 접속
   - `http://localhost:8000`

## 조작
- 이동: 방향키 또는 WASD
- 킥: Space
- 재시작: R

## 게임 규칙
- 제한시간: 90초
- 골 존(노란 영역)에 공 넣기: +10점
- 수비수와 접촉: 체력 -1
- 체력 0 또는 시간 종료 시 게임 종료

## 인증 방법(자동 배포용)
권한이 좁은 Fine-grained PAT(추천) 사용:

1. GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens
2. Token permissions 설정
   - Repository access: 배포할 리포 1개
   - Permissions
     - Contents: Read and write
     - Actions: Read and write
     - Pages: Read and write
3. 토큰 발급 후 로컬 환경변수로 저장
   - `export GITHUB_USER="<github-username>"`
   - `export GITHUB_REPO="<repo-name>"`
   - `export GITHUB_TOKEN="<fine-grained-token>"`

## 자동 배포 실행
- `./scripts/deploy_with_token.sh`

성공 시 현재 커밋이 `main`으로 push 되고, GitHub Actions가 Pages 배포를 진행.
