# Senior Kiosk - Setup Guide

## 아키텍처

```
브라우저(키오스크) → Next.js(:3000) → Express(:3001) → MySQL(EC2 localhost)
                              ↘ Express 직접 호출 (메뉴/TTS 등)
```

## 1. 의존성

```bash
npm install
```

## 2. 환경변수

```bash
cp .env.example .env
```

필수 항목:

- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_API_URL` (키오스크 단말에서 접근 가능한 API 주소)

## 3. MySQL (EC2 Ubuntu)

### 자동 설치 + 운영 덤프 복원

```bash
export DB_PASSWORD='강한비밀번호'
bash scripts/setup-ec2-mysql.sh
```

또는:

```bash
export DB_PASSWORD='강한비밀번호'
npm run setup:mysql
```

`server/db/senior_kiosk.sql` 이 복원됩니다. (메뉴 21종 + 대화 기록 포함)

### 수동 설치

```bash
sudo apt update && sudo apt install -y mysql-server
sudo systemctl enable --now mysql

sudo mysql <<'SQL'
CREATE DATABASE senior_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kiosk'@'localhost' IDENTIFIED BY 'STRONG_PW';
GRANT ALL PRIVILEGES ON senior_kiosk.* TO 'kiosk'@'localhost';
FLUSH PRIVILEGES;
SQL

mysql -u kiosk -p senior_kiosk < server/db/senior_kiosk.sql
```

## 4. 실행

### 개발

```bash
npm run dev:all
```

### 프로덕션 (EC2)

```bash
npm run build
npm run pm2:start
pm2 save
```

또는 한 번에:

```bash
npm run deploy:ec2
```

## 5. 확인

```bash
curl -s http://127.0.0.1:3001/health
# {"status":"ok","db":"connected",...}

curl -s http://127.0.0.1:3001/api/menu | head
```

## API 엔드포인트

- `POST /api/voice-order`
- `GET /api/menu`
- `POST /api/cart` / `GET /api/cart/:sessionId`
- `POST /api/tts`
- `GET /health`

## 문제 해결

| 증상 | 확인 |
|------|------|
| MySQL 연결 실패 | `DB_HOST=127.0.0.1`, mysql 서비스 실행 여부 |
| 메뉴 없음 | `npm run db:import` 로 덤프 재적용 |
| TTS 503 | `GOOGLE_TTS_API_KEY` 설정 |
| 마이크 안 됨 | HTTPS 사용, 브라우저 권한 확인 |
