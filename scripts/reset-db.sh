#!/usr/bin/env bash
# Bridge - DB 볼륨 삭제 후 재기동 (⚠️ 모든 데이터 삭제)
# 사용법: ./scripts/reset-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "⚠️  경고: PostgreSQL 데이터 볼륨(pgdata)이 완전히 삭제됩니다."
echo "    모든 사용자·일기·루틴 데이터가 사라집니다."
read -r -p "정말 진행하시겠습니까? (yes/no): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
  echo "❌ 취소되었습니다."
  exit 1
fi

echo "🛑 컨테이너 + 볼륨 삭제 중..."
docker compose down -v

echo "🚀 재기동 중..."
./scripts/start.sh

echo "✅ DB 초기화 완료. Alembic 마이그레이션은 entrypoint.sh 에서 자동 실행됩니다."
