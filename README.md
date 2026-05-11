# Senior Kiosk

시니어 사용자를 위한 음성 기반 키오스크 주문 시스템.

## 개요

- 음성으로 메뉴를 검색·선택하고, 옵션·세트 구성, 포인트 적립, 쿠폰 적용, 결제까지 진행하는 키오스크 흐름을 제공.
- 손쉬운 사용을 위해 큰 버튼 UI, 음성 안내(TTS), 음성 인식(STT)을 결합.
- 매장 키오스크와 모바일/QR 진입(`?entry=qr`) 두 흐름을 지원.

## 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Node.js, Express |
| DB | MySQL (`mysql2/promise`) |
| 음성 인식(STT) | Web Speech API (브라우저) |
| 음성 합성(TTS) | Google Cloud TTS REST (서버 라우트 `/api/tts`) |
| 대화/주문 해석 | OpenAI Chat Completions |
| 배포 | AWS EC2 (Ubuntu) + PM2 권장 + HTTPS(마이크권한)|

## 주요 화면 흐름

1. 시작 → 주문 방식 선택
2. 메뉴 페이지 (`/menu`)
3. 메뉴 옵션 (`/menu-option`) - 단품 / 기본 세트 / 세트 직접 선택
4. 포인트 적립 / 쿠폰 (`/points`, `/phone-input`)
5. 결제 (`/payment`)

## 디렉토리

```
src/app/         # Next.js 페이지 (메뉴, 옵션, 결제 등)
src/components/  # 공통 UI 컴포넌트
server/          # Express 서버 (라우트, DB)
server/db/       # MySQL 스키마 SQL
public/          # 메뉴 이미지 등 정적 자원
```

## API

Express(기본 포트 `3001`):

- `POST /api/voice-order` — 음성/대화 기반 주문 해석
- `GET  /api/menu` — 메뉴 목록 조회
- `POST /api/cart` / `GET /api/cart/:sessionId` — 장바구니 저장/조회
- `POST /api/tts` — Google Cloud TTS 음성 합성
- `GET  /health` — 헬스 체크

Next.js 측에는 `/api/voice-order` 등 일부 프록시 라우트가 함께 존재.

## 데이터베이스

- 스키마 정의: `server/db/schema.sql`
- 추가 메뉴 시드: `server/db/add_drinks_sides_menu.sql`

```bash
mysql -u <user> -p senior_kiosk < server/db/schema.sql
mysql -u <user> -p senior_kiosk < server/db/add_drinks_sides_menu.sql
```

## 배포 (요약)

EC2(Ubuntu) 기준 권장 흐름.

```bash
# 1) MySQL 설치
sudo apt update && sudo apt install -y mysql-server
sudo systemctl enable --now mysql

# 2) DB / 사용자 / 스키마
sudo mysql <<'SQL'
CREATE DATABASE senior_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kiosk'@'localhost' IDENTIFIED BY 'STRONG_PW';
GRANT ALL PRIVILEGES ON senior_kiosk.* TO 'kiosk'@'localhost';
FLUSH PRIVILEGES;
SQL
mysql -u kiosk -p senior_kiosk < server/db/schema.sql

# 3) 코드 / 의존성
git pull
npm ci
npm run build

# 4) PM2 로 실행
pm2 start "npm run server" --name kiosk-api
pm2 start "npm run start"  --name kiosk-web
pm2 save
```

> 환경변수 설정과 로컬 개발 가이드는 `DEVELOPMENT.md` 참고.

## 라이선스

내부 프로젝트.
