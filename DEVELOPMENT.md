# Development Guide

로컬 개발 및 EC2(Ubuntu + 내부 MySQL) 배포 가이드.

## 요구사항

- Node.js 18+
- MySQL 8.x (EC2는 `scripts/setup-ec2-mysql.sh`로 설치)
- OpenAI API Key (음성 주문 해석)
- Google Cloud TTS API Key (음성 안내)

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # 값 입력
npm run dev:all              # Next.js(3000) + Express(3001)
```

## 환경변수

`.env.local` (없으면 `.env`) — `.env.local`이 우선.

```env
EXPRESS_PORT=3001
EXPRESS_API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kiosk
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=senior_kiosk

OPENAI_API_KEY=sk-...
GOOGLE_TTS_API_KEY=AIza...
# 구버전 호환: GOOGLE_API_KEY 도 인식됨
```

### EC2에서 중요한 점

- `DB_HOST=127.0.0.1` — EC2 **내부** MySQL 사용 시 필수.
- `NEXT_PUBLIC_API_URL` — 키오스크 단말에서 접근 가능한 EC2 공인 IP/도메인.
- `EXPRESS_API_URL` — Next.js → Express 프록시. 같은 EC2면 `http://127.0.0.1:3001`.

## DB 초기화

### A) 운영 덤프 복원 (권장)

```bash
export DB_PASSWORD='비밀번호'
npm run setup:mysql

# 덤프만 다시 넣기
npm run db:import
```

### B) 빈 DB + 메뉴 시드

```bash
mysql -u root -p < server/db/schema.sql
mysql -u kiosk -p senior_kiosk < server/db/add_drinks_sides_menu.sql
```

## EC2 배포

```bash
npm run deploy:ec2
```

PM2:

```bash
npm run pm2:start
npm run pm2:restart
pm2 logs senior-kiosk-api --lines 100
```

## TTS / STT

- TTS: Google Cloud TTS REST (`GOOGLE_TTS_API_KEY` 또는 `GOOGLE_API_KEY`)
- STT: 브라우저 Web Speech API — HTTPS 또는 localhost 필요

## 자주 만나는 문제

### MySQL `Access denied`

- `.env`의 `DB_HOST`, `DB_USER`, `DB_PASSWORD` 확인
- PM2 환경변수 충돌 시: `pm2 restart all --update-env`

### API 연결 실패 (브라우저)

- `NEXT_PUBLIC_API_URL`이 키오스크 단말에서 접근 가능한지 확인
- EC2 보안 그룹에서 3000/3001(또는 Nginx 443) 허용

### `/health` 가 `db: disconnected`

```bash
sudo systemctl status mysql
mysql -u kiosk -p -e "USE senior_kiosk; SELECT COUNT(*) FROM menu;"
```

### TTS 503

- `GOOGLE_TTS_API_KEY` 또는 `GOOGLE_API_KEY` 설정 후 서버 재시작
