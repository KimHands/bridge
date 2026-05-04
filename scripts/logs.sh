#!/usr/bin/env bash
# Bridge - 백엔드 컨테이너 로그 실시간 보기
# 사용법:
#   ./scripts/logs.sh           # api 로그만 (기본값)
#   ./scripts/logs.sh all       # 전체 컨테이너
#   ./scripts/logs.sh db        # 특정 서비스 (db, redis, api)
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-api}"

if [[ "$TARGET" == "all" ]]; then
  echo "📜 전체 컨테이너 로그 (Ctrl+C 로 종료)"
  docker compose logs -f
else
  echo "📜 [$TARGET] 로그 (Ctrl+C 로 종료)"
  docker compose logs -f "$TARGET"
fi
