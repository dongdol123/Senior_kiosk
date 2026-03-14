"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

export default function PointsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);
    const searchParamsRef = useRef(null);
    const totalRef = useRef(0);
    const orderTypeRef = useRef("takeout");
    const routerRef = useRef(null);

    useEffect(() => {
        const totalParam = searchParams.get("total");
        const orderTypeParam = searchParams.get("orderType");

        searchParamsRef.current = searchParams;

        if (totalParam) {
            const totalValue = parseInt(totalParam);
            setTotal(totalValue);
            totalRef.current = totalValue;
        }
        if (orderTypeParam) {
            setOrderType(orderTypeParam);
            orderTypeRef.current = orderTypeParam;
        }
    }, [searchParams]);

    // router와 searchParams ref 업데이트
    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    // 음성 인식
    useEffect(() => {
        mountedRef.current = true;
        firstStartRef.current = true;

        const SpeechRecognition =
            typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
        if (!SpeechRecognition) {
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "ko-KR";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = async () => {
            setIsListening(true);
            // 처음 시작할 때만 인사말
            if (firstStartRef.current) {
                firstStartRef.current = false;
                const greeting = "적립 하시겠어요?";
                setAssistantMessage(greeting);
                await speakKorean(greeting);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current) {
                setTimeout(() => {
                    try { recognition.start(); } catch { }
                }, 500);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            // 음성 인식 로그 추가
            const logEntry = {
                time: new Date().toLocaleTimeString('ko-KR'),
                transcript: transcript,
                normalized: normalized
            };
            setVoiceLogs((prev) => {
                const newLogs = [logEntry, ...prev].slice(0, 10);
                return newLogs;
            });

            // 적립한다고 하면 핸드폰 번호 입력 페이지로 이동 (적립할게 포함)
            if (/적립|한다|할래|하겠|해줘|해주|할게/.test(normalized)) {
                console.log("✅ 적립 명령 인식됨:", transcript, "normalized:", normalized);
                // 음성 인식 먼저 중지
                try {
                    recognition.stop();
                } catch (e) {
                    console.error("음성 인식 중지 오류:", e);
                }

                const msg = "핸드폰 번호로 적립하시겠어요?";
                setAssistantMessage(msg);

                // 음성 안내는 백그라운드에서 실행하고, 페이지 이동은 즉시
                speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));

                // 핸드폰 번호 입력 페이지로 이동 (최신 값 사용)
                console.log("🚀 핸드폰 번호 입력 페이지로 이동");
                setTimeout(() => {
                    console.log("페이지 이동 실행");
                    const cartData = searchParamsRef.current?.get("cart") || "";
                    if (routerRef.current) {
                        routerRef.current.push(`/phone-input?cart=${cartData}&total=${totalRef.current}&orderType=${orderTypeRef.current}`);
                    }
                }, 1000);
                return;
            }

            // 필요없다고 하면 적립 없이 결제
            if (/필요없|안할래|안하겠|안해|없어|안해줘/.test(normalized)) {
                console.log("✅ 적립 없이 결제 명령 인식됨:", transcript, "normalized:", normalized);
                // 음성 인식 먼저 중지
                try {
                    recognition.stop();
                } catch (e) {
                    console.error("음성 인식 중지 오류:", e);
                }

                const msg = "적립 없이 결제하시겠어요?";
                setAssistantMessage(msg);

                // 음성 안내는 백그라운드에서 실행하고, 페이지 이동은 즉시
                speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));

                // 결제 페이지로 이동 (최신 값 사용)
                console.log("🚀 결제 페이지로 이동");
                setTimeout(() => {
                    console.log("페이지 이동 실행");
                    const cartData = searchParamsRef.current?.get("cart") || "";
                    if (routerRef.current) {
                        routerRef.current.push(`/payment?cart=${cartData}&total=${totalRef.current}&orderType=${orderTypeRef.current}`);
                    }
                }, 1000);
                return;
            }

            const msg = "적립하시겠어요, 아니면 적립 없이 결제하시겠어요?";
            setAssistantMessage(msg);
            await speakKorean(msg);
        };

        recognitionRef.current = recognition;

        try {
            recognition.start();
        } catch (e) {
            // 권한 오류는 무시
        }

        return () => {
            mountedRef.current = false;
            try {
                if (recognitionRef.current) {
                    recognitionRef.current.onresult = null;
                    recognitionRef.current.onend = null;
                    recognitionRef.current.onerror = null;
                    recognitionRef.current.onstart = null;
                    recognitionRef.current.stop();
                }
            } catch { }
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
        };
    }, []);

    function handleBack() {
        const cartData = searchParams.get("cart");
        router.push(`/order-confirm?cart=${cartData}&total=${total}&orderType=${orderType}`);
    }

    function handlePointsWithPhone() {
        const cartData = searchParams.get("cart");
        router.push(`/phone-input?cart=${cartData}&total=${total}&orderType=${orderType}`);
    }

    function handlePaymentWithoutPoints() {
        // 적립 없이 결제 진행
        const cartData = searchParams.get("cart");
        router.push(`/payment?cart=${cartData}&total=${total}&orderType=${orderType}`);
    }

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: "#f9f9f9",
            }}
        >
            {/* 음성 인식 로그창 - 항상 표시 */}
            <div
                style={{
                    position: "fixed",
                    top: "10px",
                    right: "10px",
                    width: "300px",
                    maxHeight: "400px",
                    backgroundColor: "#fff",
                    border: "2px solid #1e7a39",
                    borderRadius: "12px",
                    padding: "12px",
                    zIndex: 1000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    overflowY: "auto",
                }}
            >
                <div style={{ fontWeight: "bold", marginBottom: "8px", color: "#1e7a39", fontSize: "0.9rem" }}>
                    🎤 음성 인식 로그
                </div>
                {voiceLogs.length === 0 ? (
                    <div style={{ color: "#999", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                        음성 인식 대기 중...
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {voiceLogs.map((log, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: "8px",
                                    backgroundColor: "#f5f5f5",
                                    borderRadius: "6px",
                                    fontSize: "0.85rem",
                                }}
                            >
                                <div style={{ color: "#666", fontSize: "0.75rem", marginBottom: "4px" }}>
                                    {log.time}
                                </div>
                                <div style={{ fontWeight: "600", marginBottom: "2px" }}>
                                    {log.transcript}
                                </div>
                                <div style={{ color: "#888", fontSize: "0.75rem" }}>
                                    (정규화: {log.normalized})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* 상단 헤더 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    backgroundColor: "#fff",
                    borderBottom: "2px solid #e5e5e5",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>적립하기</h2>
                    <div
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: isListening ? "#e6f4ea" : "#eee",
                            color: isListening ? "#1e7a39" : "#777",
                            border: isListening ? "1px solid #bfe3ca" : "1px solid #ddd",
                            borderRadius: "999px",
                            padding: "6px 12px",
                            fontWeight: "bold",
                            fontSize: "0.9rem",
                        }}
                    >
                        <span style={{ width: 8, height: 8, background: isListening ? "#34c759" : "#bbb", borderRadius: "50%" }} />
                        {isListening ? "음성 인식 중" : "대화로 선택 가능"}
                    </div>
                </div>
                <button
                    onClick={handleBack}
                    style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #ddd",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        cursor: "pointer",
                    }}
                >
                    뒤로 가기
                </button>
            </div>

            {/* 음성 안내 메시지 */}
            {assistantMessage && (
                <div
                    style={{
                        padding: "12px 16px",
                        backgroundColor: "#fff",
                        borderBottom: "1px solid #e5e5e5",
                        textAlign: "center",
                        color: "#1e7a39",
                        fontWeight: "600",
                    }}
                >
                    {assistantMessage}
                </div>
            )}

            {/* 메인 컨텐츠 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px 20px",
                    gap: "30px",
                    maxWidth: "800px",
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                <div
                    style={{
                        background: "#fff",
                        border: "1px solid #e5e5e5",
                        borderRadius: "16px",
                        padding: "30px",
                        width: "100%",
                        textAlign: "center",
                    }}
                >
                    <h3 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "20px" }}>
                        포인트 적립
                    </h3>
                    <p style={{ color: "#777", marginBottom: "30px", fontSize: "1.1rem" }}>
                        핸드폰 번호로 포인트를 적립하시겠어요?
                    </p>
                    <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#1e7a39", marginBottom: "30px" }}>
                        결제 금액: {total.toLocaleString()}원
                    </div>
                </div>

                {/* 버튼들 */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        width: "100%",
                    }}
                >
                    <button
                        onClick={handlePointsWithPhone}
                        style={{
                            width: "100%",
                            padding: "24px",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            backgroundColor: "#1e7a39",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            cursor: "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        }}
                    >
                        핸드폰 번호로 적립하기
                    </button>

                    <button
                        onClick={handlePaymentWithoutPoints}
                        style={{
                            width: "100%",
                            padding: "24px",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            backgroundColor: "#fff",
                            color: "#333",
                            border: "2px solid #ddd",
                            borderRadius: "16px",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                        }}
                    >
                        적립없이 결제하기
                    </button>
                </div>
            </div>
        </main>
    );
}

