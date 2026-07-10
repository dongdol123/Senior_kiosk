#!/usr/bin/env bash
# EC2(Ubuntu)에서 MySQL 설치 + senior_kiosk DB 복원
#
# 사용 예:
#   export DB_PASSWORD='강한비밀번호'
#   bash scripts/setup-ec2-mysql.sh
#
# 선택 변수:
#   DB_NAME=senior_kiosk
#   DB_USER=kiosk
#   SQL_FILE=server/db/senior_kiosk.sql

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${DB_NAME:-senior_kiosk}"
DB_USER="${DB_USER:-kiosk}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD 환경변수를 설정하세요}"
SQL_FILE="${SQL_FILE:-${ROOT_DIR}/server/db/senior_kiosk.sql}"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "❌ SQL 파일 없음: ${SQL_FILE}"
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "📦 MySQL 설치 중..."
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  sudo systemctl enable --now mysql
fi

echo "🗄️  DB/사용자 생성: ${DB_NAME} / ${DB_USER}"
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "📥 덤프 복원: ${SQL_FILE}"
mysql -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "${SQL_FILE}"

echo "✅ MySQL 준비 완료"
mysql -u "${DB_USER}" -p"${DB_PASSWORD}" -e "USE ${DB_NAME}; SHOW TABLES; SELECT COUNT(*) AS menu_count FROM menu;"
