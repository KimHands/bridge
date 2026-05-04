#!/usr/bin/env bash
# Bridge - 백엔드(Docker Compose) 기동
# 사용법: ./scripts/start.sh
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE 가 없습니다. backend/.env.example 을 복사해서 만들어주세요."
  echo "   cp backend/.env.example backend/.env"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker 가 설치되어 있지 않습니다."
  exit 1
fi

echo "🐳 Docker Compose 기동 중 (api + db + redis)..."
docker compose up -d

echo "⏳ API 헬스체크 대기 (최대 60초)..."
for i in {1..30}; do
  if curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
    echo "✅ API 정상 (http://localhost:8000)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "⚠️  API 헬스체크 실패. 'scripts/logs.sh' 로 로그 확인 필요."
    exit 1
  fi
  sleep 2
done

cat <<EOF

📡 백엔드 준비 완료
  - API:    http://localhost:8000
  - Health: http://localhost:8000/health
  - DB:     postgres://localhost:5432
  - Redis:  redis://localhost:6379

▶️  다음 단계
  - 모바일 실행:   cd mobile && npm start
  - 한 번에 실행:  ./scripts/dev.sh
  - 로그 보기:     ./scripts/logs.sh
  - 중지:          ./scripts/stop.sh
EOF
