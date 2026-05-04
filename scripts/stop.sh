#!/usr/bin/env bash
# Bridge - 백엔드 컨테이너 정지
# 사용법: ./scripts/stop.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🛑 Docker Compose 컨테이너 정지 중..."
docker compose down

echo "✅ 정지 완료 (DB 데이터는 보존됨)"
echo "   - 데이터까지 초기화하려면: ./scripts/reset-db.sh"
