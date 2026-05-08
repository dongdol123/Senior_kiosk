# Development Guide

로컬에서 개발하고 EC2에 배포하기 위한 환경 구성 가이드.

## 요구사항

- Node.js 18+
- MySQL 8.x 또는 호환 (Ubuntu MySQL/MariaDB 가능)
- (선택) Google Cloud TTS API Key
- (선택) OpenAI API Key — 음성 주문 해석에 사용

## 설치 및 실행

```bash
npm install
npm run dev:all   # Next.js + Express 동시 실행
# 개별 실행이 필요하면:
#   npm run dev      # Next.js (포트 3000)
#   npm run server   # Express (포트 3001)
```

빌드/프로덕션 실행:

```bash
npm run build
npm run start     # Next.js
npm run server    # Express
```

## 환경변수

`.env.local` (없으면 `.env`) 파일을 프로젝트 루트에 생성한다. 두 파일이 모두 있으면 `.env.local`이 우선.

```env
# Express
EXPRESS_PORT=3001
EXPRESS_API_URL=http://localhost:3001     # Next.js → Express 프록시 시 사용

# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kiosk
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=senior_kiosk
# 소켓 사용 시(예: Homebrew): DB_SOCKET_PATH=/tmp/mysql.sock

# OpenAI (대화/주문 해석)
OPENAI_API_KEY=sk-...

# Google Cloud TTS (REST 직접 호출)
GOOGLE_TTS_API_KEY=AIza...
GOOGLE_TTS_LANGUAGE_CODE=ko-KR
GOOGLE_TTS_VOICE_NAME=ko-KR-Neural2-A
GOOGLE_TTS_SPEAKING_RATE=0.88
GOOGLE_TTS_PITCH=0
```

> `DB_HOST`는 EC2에 로컬 MySQL 사용 시 `127.0.0.1` 권장. 서버 사설 IP가 환경에 남아 있으면 `Access denied` 에러의 원인이 된다.

## DB 초기화

```bash
mysql -u root
```

```sql
CREATE DATABASE senior_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kiosk'@'localhost' IDENTIFIED BY 'STRONG_PW';
GRANT ALL PRIVILEGES ON senior_kiosk.* TO 'kiosk'@'localhost';
FLUSH PRIVILEGES;
```

스키마 / 시드 적용:

```bash
mysql -u kiosk -p senior_kiosk < server/db/schema.sql
mysql -u kiosk -p senior_kiosk < server/db/add_drinks_sides_menu.sql
```

## TTS 동작 방식

- 서버 라우트: `server/routes/tts.js`
- Google Cloud TTS REST 엔드포인트(`texttospeech.googleapis.com`) 직접 호출.
- API 키만 필요(서비스 계정/`GOOGLE_APPLICATION_CREDENTIALS` 불필요).
- 응답은 base64 mp3 → 클라이언트에서 재생.
- 키 미설정 시 503 응답 반환(폴백 없음).

## 음성 인식(STT)

- 클라이언트 Web Speech API 기반.
- 모바일 사파리 등에선 첫 사용자 인터랙션 후에만 마이크/오디오가 활성화될 수 있음.

## 자주 만나는 문제

### MySQL: `Access denied for user '...'@'<IP>'`

- `.env(.local)`의 `DB_HOST` / `DB_USER`가 운영 환경에 맞는지 확인.
- PM2를 쓰면 PM2가 보관 중인 환경변수가 더 우선될 수 있음.

```bash
pm2 env <앱이름>
pm2 restart <앱이름> --update-env
```

### TTS 503 (`TTS service not configured`)

- `GOOGLE_TTS_API_KEY`가 비어 있거나 잘못된 값.
- 키 발급 후 서버 재시작 필요.

### 모바일에서 음성 안내가 안 들림

- 사용자가 화면을 한 번 터치한 뒤 재생되도록 브라우저 정책으로 제한됨.
- 마이크/소리 권한, 무음 모드 여부도 확인.

## 배포 메모 (EC2 Ubuntu, PM2)

```bash
pm2 start "npm run server" --name kiosk-api
pm2 start "npm run start"  --name kiosk-web
pm2 save
pm2 logs --lines 100
```

환경변수를 바꾼 뒤에는 반드시:

```bash
pm2 restart all --update-env
```
