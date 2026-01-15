"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";

export default function PointsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);

    async function speakKorean(text) {
        try {
            const synth = window.speechSynthesis;
            if (!synth) return;
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            synth.cancel();
            await new Promise((resolve) => {
                utter.onend = resolve;
                setTimeout(resolve, 5000);
                synth.speak(utter);
            });
        } catch (e) {
            // no-op
        }
    }

    useEffect(() => {
        const totalParam = searchParams.get("total");
        const orderTypeParam = searchParams.get("orderType");
        
        if (totalParam) {
            setTotal(parseInt(totalParam));
        }
        if (orderTypeParam) {
            setOrderType(orderTypeParam);
        }
    }, [searchParams]);

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
                    try { recognition.start(); } catch {}
                }, 500);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.toLowerCase().replace(/\s/g, "");

            // 적립한다고 하면 핸드폰 번호 입력 페이지로 이동
            if (/적립|한다|할래|하겠|해줘|해주/.test(normalized)) {
                const msg = "핸드폰 번호로 적립하시겠어요?";
                setAssistantMessage(msg);
                await speakKorean(msg);
                setTimeout(() => {
                    handlePointsWithPhone();
                }, 1500);
                return;
            }

            // 필요없다고 하면 적립 없이 결제
            if (/필요없|안할래|안하겠|안해|없어|안해줘/.test(normalized)) {
                const msg = "적립 없이 결제하시겠어요?";
                setAssistantMessage(msg);
                await speakKorean(msg);
                setTimeout(() => {
                    handlePaymentWithoutPoints();
                }, 1500);
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
            } catch {}
            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch {}
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
        // 적립 없이 결제 진행 (추후 구현)
        alert(`결제하기: ${total.toLocaleString()}원`);
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

