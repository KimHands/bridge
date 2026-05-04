#!/usr/bin/env bash
# Bridge - 백엔드 + 모바일 한 번에 실행
# 백엔드는 백그라운드(Docker), 모바일(Expo)은 포그라운드로 실행됩니다.
# Ctrl+C 로 Expo 만 종료되며, 백엔드는 계속 떠 있습니다. (정지: ./scripts/stop.sh)
set -euo pipefail

cd "$(dirname "$0")/.."

# 1) 백엔드 기동
./scripts/start.sh

# 2) 모바일 의존성 확인
if [[ ! -d "mobile/node_modules" ]]; then
  echo "📦 mobile/node_modules 가 없습니다. npm install 실행..."
  (cd mobile && npm install)
fi

# 3) Expo 포그라운드 실행
echo ""
echo "📱 Expo 시작 (Ctrl+C 로 종료)"
echo "   백엔드는 종료되지 않습니다. 정지하려면: ./scripts/stop.sh"
echo ""
cd mobile && npm start
