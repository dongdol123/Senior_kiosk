# OpenAI TTS 설정 가이드

## 1. 패키지 설치

```bash
npm install
```

## 2. OpenAI API 키 설정

1. [OpenAI Platform](https://platform.openai.com/)에서 계정 생성
2. API 키 생성 (Settings > API keys)
3. `.env` 파일에 API 키 추가

## 3. 환경 변수 설정

`.env` 파일에 다음 변수를 추가하세요:

```env
# OpenAI API Key (기존 voice-order에서 사용 중인 키와 동일)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## 4. TTS 모델 옵션

현재 설정:
- **모델**: `tts-1` (빠르고 저렴) 또는 `tts-1-hd` (고품질, 비용 높음)
- **음성**: `nova` (자연스러운 여성 목소리)
  - 다른 옵션: `alloy`, `echo`, `fable`, `onyx`, `shimmer`
- **속도**: `0.95` (0.25 ~ 4.0 범위)

음성을 변경하려면 `server/routes/tts.js`의 `voice` 옵션을 수정하세요.

## 5. Fallback 동작

OpenAI TTS가 설정되지 않거나 실패한 경우, 자동으로 브라우저 기본 TTS로 fallback됩니다.

## 6. 테스트

서버를 실행하고 TTS가 정상 작동하는지 확인:

```bash
npm run dev:all
```

음성 안내가 OpenAI TTS로 재생되는지 확인하세요.

## 7. 비용 참고

- `tts-1`: $15.00 / 1M 문자
- `tts-1-hd`: $30.00 / 1M 문자

한국어는 문자 단위로 과금되므로, 짧은 안내 메시지의 경우 비용이 매우 낮습니다.

