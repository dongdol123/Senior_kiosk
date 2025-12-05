# Senior Kiosk - Setup Guide

## 아키텍처

```
Frontend (Next.js) → Express Server → OpenAI & MySQL → Express → Frontend
```

## 필수 요구사항

- Node.js 18+
- MySQL 8.0+
- OpenAI API Key

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. MySQL 데이터베이스 설정

```bash
# MySQL 접속
mysql -u root -p

# 스키마 실행
mysql -u root -p < server/db/schema.sql
```

또는 MySQL Workbench에서 `server/db/schema.sql` 파일을 실행하세요.

### 3. 환경 변수 설정

`.env` 파일을 프로젝트 루트에 생성하고 다음 내용을 추가하세요:

```env
# Express Server
EXPRESS_PORT=3001

# MySQL Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=senior_kiosk

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# Next.js API Proxy (선택사항)
EXPRESS_API_URL=http://localhost:3001
```

### 4. 서버 실행

#### 옵션 1: 동시 실행 (권장)

```bash
npm run dev:all
```

이 명령은 Next.js (포트 3000)와 Express (포트 3001)를 동시에 실행합니다.

#### 옵션 2: 별도 실행

터미널 1 - Next.js:
```bash
npm run dev
```

터미널 2 - Express:
```bash
npm run server
```

## API 엔드포인트

### Express Server (포트 3001)

- `POST /api/voice-order` - 음성 주문 처리 (OpenAI + DB 저장)
- `POST /api/cart` - 장바구니 저장
- `GET /api/cart/:sessionId` - 장바구니 조회
- `GET /health` - 서버 상태 확인

### Next.js API Routes (포트 3000)

- `POST /api/voice-order` - Express 서버로 프록시

## 데이터베이스 스키마

- `conversations` - 대화 기록 저장
- `carts` - 장바구니 상태 저장
- `orders` - 주문 내역 저장 (향후 사용)

## 문제 해결

### MySQL 연결 오류
- `.env` 파일의 DB 설정 확인
- MySQL 서비스가 실행 중인지 확인
- 데이터베이스가 생성되었는지 확인

### Express 서버가 시작되지 않음
- 포트 3001이 사용 중인지 확인
- `.env` 파일이 올바른지 확인

### OpenAI API 오류
- API 키가 올바른지 확인
- API 사용량/크레딧 확인


