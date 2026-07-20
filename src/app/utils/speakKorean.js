// 음성 재생 큐 - 한 번에 하나의 음성만 재생
let audioQueue = [];
let isPlaying = false;
let currentAudio = null;
let isTtsPlaybackActive = false;

function setTtsPlaybackActive(active) {
    isTtsPlaybackActive = active;
    if (typeof window !== "undefined") {
        window.__kioskTtsPlaybackActive = active;
    }
}

export function isTtsActive() {
    if (typeof window !== "undefined" && typeof window.__kioskTtsPlaybackActive === "boolean") {
        return window.__kioskTtsPlaybackActive;
    }
    return isTtsPlaybackActive;
}

/**
 * 큐에 있는 다음 음성을 재생
 */
async function playNext() {
    if (isPlaying || audioQueue.length === 0) {
        if (!isPlaying && audioQueue.length === 0) {
            setTtsPlaybackActive(false);
        }
        return;
    }

    isPlaying = true;
    const { text, resolve, reject, blockRecognition } = audioQueue.shift();

    try {
        // 서버의 TTS API 호출 (Google Cloud TTS — 원래 목소리)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/api/tts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            console.warn("TTS API failed, using browser fallback");
            await fallbackSpeakKorean(text);
            resolve();
            isPlaying = false;
            playNext();
            return;
        }

        const data = await response.json();

        if (data.audio) {
            const audioBlob = base64ToBlob(data.audio, "audio/mp3");
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
                currentAudio.play().catch(async (err) => {
                    if (isNotAllowedPlaybackError(err)) {
                        URL.revokeObjectURL(audioUrl);
                        currentAudio = null;
                        try {
                            await fallbackSpeakKorean(text);
                        } catch (_) {}
                        resolveAudio();
                        return;
                    }
                    rejectAudio(err);
                });
            });
        }
        resolve();
    } catch (error) {
        console.error("TTS Error:", error);
        try {
            await fallbackSpeakKorean(text);
        } catch (e) {
            console.error("Fallback TTS also failed:", e);
        }
        reject(error);
    } finally {
        isPlaying = false;
        currentAudio = null;
        if (blockRecognition !== false && audioQueue.length === 0) {
            setTtsPlaybackActive(false);
        }
        playNext();
    }
}

/**
 * Google Cloud TTS (원래 키오스크 목소리)
 * @param {string} text
 * @param {{ blockRecognition?: boolean }} [options]
 */
export async function speakKorean(text, options = {}) {
    if (!text || typeof text !== "string") {
        return;
    }

    const blockRecognition = options.blockRecognition !== false;

    if (currentAudio) {
        try {
            try {
                currentAudio.onended = null;
            } catch (_) {}
            try {
                currentAudio.onerror = null;
            } catch (_) {}
            currentAudio.pause();
            currentAudio.currentTime = 0;
        } catch (e) {
            console.error("Error stopping current audio:", e);
        }
        currentAudio = null;
    }

    isPlaying = false;

    if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
            window.speechSynthesis.cancel();
        } catch (_) {}
    }

    audioQueue = [];

    return new Promise((resolve, reject) => {
        if (blockRecognition) {
            setTtsPlaybackActive(true);
        } else {
            // 사이즈 확인 등: 원래 목소리는 재생하되 음성 인식/화면 전환은 막지 않음
            setTtsPlaybackActive(false);
        }
        audioQueue.push({ text, resolve, reject, blockRecognition });
        playNext();
    });
}

function fallbackSpeakKorean(text) {
    try {
        const synth = window.speechSynthesis;
        if (!synth) return Promise.resolve();

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "ko-KR";
        utter.rate = 0.95;

        synth.cancel();

        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                resolve();
            };
            utter.onend = finish;
            utter.onerror = finish;
            setTimeout(finish, 1200);
            synth.speak(utter);
        });
    } catch (e) {
        console.error("Fallback TTS Error:", e);
        return Promise.resolve();
    }
}

/**
 * 원래 Google TTS 목소리로 재생하되, await/인식 대기는 하지 않음
 */
export function speakKoreanQuick(text) {
    if (!text || typeof text !== "string") return Promise.resolve();
    // 백그라운드 재생 — 호출부는 바로 다음 단계로
    void speakKorean(text, { blockRecognition: false }).catch(() => {});
    return Promise.resolve();
}

function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

function isNotAllowedPlaybackError(err) {
    if (!err) return false;
    const name = String(err.name || "");
    const message = String(err.message || "");
    return name === "NotAllowedError" || message.includes("user didn't interact");
}
