export function stopVoiceSession(recognition, shouldListenRef, isSpeakingRef) {
    if (shouldListenRef) shouldListenRef.current = false;
    if (isSpeakingRef) isSpeakingRef.current = false;

    try {
        if (recognition) {
            recognition.onresult = null;
            recognition.onend = null;
            recognition.onerror = null;
            recognition.onstart = null;
            recognition.stop();
        }
    } catch {}

    if (typeof window !== "undefined") {
        try {
            if (window.currentRecognition && window.currentRecognition !== recognition) {
                window.currentRecognition.stop();
            }
        } catch {}

        try {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        } catch {}
    }
}

export function registerVoiceSession(recognition) {
    if (typeof window === "undefined") return;
    window.currentRecognition = recognition;
}
