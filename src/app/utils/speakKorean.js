// 음성 재생 큐 - 한 번에 하나의 음성만 재생
let audioQueue = [];
let isPlaying = false;
let currentAudio = null;

/**
 * 큐에 있는 다음 음성을 재생
 */
async function playNext() {
    if (isPlaying || audioQueue.length === 0) {
        return;
    }

    isPlaying = true;
    const { text, resolve, reject } = audioQueue.shift();

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
            await fallbackSpeakKorean(text);
            resolve();
            isPlaying = false;
            playNext(); // 다음 큐 재생
            return;
        }

        const data = await response.json();

        if (data.audio) {
            // Base64 오디오를 디코딩하여 재생
            const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
            const audioUrl = URL.createObjectURL(audioBlob);
            currentAudio = new Audio(audioUrl);

            await new Promise((resolveAudio, rejectAudio) => {
                currentAudio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    currentAudio = null;
                    resolveAudio();
                };
                currentAudio.onerror = (e) => {
                    URL.revokeObjectURL(audioUrl);
                    currentAudio = null;
                    rejectAudio(e);
                };
                currentAudio.play().catch(rejectAudio);
            });
        }
        resolve();
    } catch (error) {
        console.error('TTS Error:', error);
        // 에러 발생 시 브라우저 기본 TTS로 fallback
        try {
            await fallbackSpeakKorean(text);
        } catch (e) {
            console.error('Fallback TTS also failed:', e);
        }
        reject(error);
    } finally {
        isPlaying = false;
        currentAudio = null;
        // 다음 큐 재생
        playNext();
    }
}

/**
 * Google WaveNet TTS를 사용하여 한국어 텍스트를 음성으로 변환
 * 한 번에 하나의 음성만 재생되도록 큐잉 시스템 사용
 * @param {string} text - 음성으로 변환할 텍스트
 * @returns {Promise<void>}
 */
export async function speakKorean(text) {
    if (!text || typeof text !== 'string') {
        return;
    }

    // 현재 재생 중인 음성이 있으면 취소하고 큐 비우기
    if (currentAudio) {
        try {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        } catch (e) {
            console.error('Error stopping current audio:', e);
        }
    }

    // 브라우저 TTS도 취소
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }

    // 큐 비우기
    audioQueue = [];

    // 새 음성을 큐에 추가하고 즉시 재생
    return new Promise((resolve, reject) => {
        audioQueue.push({ text, resolve, reject });
        playNext();
    });
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


