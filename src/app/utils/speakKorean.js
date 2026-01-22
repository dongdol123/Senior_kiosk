/**
 * Google WaveNet TTS를 사용하여 한국어 텍스트를 음성으로 변환
 * @param {string} text - 음성으로 변환할 텍스트
 * @returns {Promise<void>}
 */
export async function speakKorean(text) {
    if (!text || typeof text !== 'string') {
        return;
    }

    try {
        // 서버의 TTS API 호출
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            // TTS API가 실패하면 브라우저 기본 TTS로 fallback
            console.warn('TTS API failed, using browser fallback');
            return fallbackSpeakKorean(text);
        }

        const data = await response.json();
        
        if (data.audio) {
            // Base64 오디오를 디코딩하여 재생
            const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            await new Promise((resolve, reject) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                audio.onerror = (e) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(e);
                };
                audio.play().catch(reject);
            });
        }
    } catch (error) {
        console.error('TTS Error:', error);
        // 에러 발생 시 브라우저 기본 TTS로 fallback
        return fallbackSpeakKorean(text);
    }
}

/**
 * 브라우저 기본 TTS (fallback)
 */
function fallbackSpeakKorean(text) {
    try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ko-KR';
        utter.rate = 0.95;
        
        synth.cancel();
        
        return new Promise((resolve) => {
            utter.onend = resolve;
            setTimeout(resolve, 5000);
            synth.speak(utter);
        });
    } catch (e) {
        console.error('Fallback TTS Error:', e);
    }
}

/**
 * Base64 문자열을 Blob으로 변환
 */
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

