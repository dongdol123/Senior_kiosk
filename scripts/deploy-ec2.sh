#!/usr/bin/env bash
# EC2 앱 배포 (코드 pull → build → PM2 재시작)
#
# 사전 조건:
#   - Node.js 18+, npm, pm2 설치
#   - .env 설정 완료
#   - scripts/setup-ec2-mysql.sh 로 DB 복원 완료

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -f .env && ! -f .env.local ]]; then
  echo "❌ .env 또는 .env.local 이 없습니다. .env.example 을 복사해 설정하세요."
  exit 1
fi

echo "📦 의존성 설치"
npm ci

echo "🏗️  Next.js 빌드"
npm run build

echo "🚀 PM2 시작/재시작"
if pm2 describe senior-kiosk-api >/dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save
pm2 status

echo "✅ 배포 완료"
echo "   API health: curl -s http://127.0.0.1:3001/health"
echo "   Web:        curl -I http://127.0.0.1:3000"
