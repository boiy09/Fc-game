#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_USER:?GITHUB_USER is required}"
: "${GITHUB_REPO:?GITHUB_REPO is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"

TARGET_BRANCH="${TARGET_BRANCH:-main}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

REPO_URL="https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git"

if git remote get-url "${REMOTE_NAME}" >/dev/null 2>&1; then
  git remote set-url "${REMOTE_NAME}" "${REPO_URL}"
else
  git remote add "${REMOTE_NAME}" "${REPO_URL}"
fi

# 현재 커밋을 main으로 배포
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
echo "Pushing commit ${CURRENT_COMMIT} to ${GITHUB_USER}/${GITHUB_REPO}:${TARGET_BRANCH}"
git push "${REMOTE_NAME}" "HEAD:${TARGET_BRANCH}"

echo "Done. GitHub Pages URL(예상): https://${GITHUB_USER}.github.io/${GITHUB_REPO}/"
