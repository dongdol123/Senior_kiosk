"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

export default function PaymentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [total, setTotal] = useState(0);
    const [cartData, setCartData] = useState("");
    const [orderType, setOrderType] = useState("takeout");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);

    useEffect(() => {
        // URL 파라미터에서 데이터 로드
        const totalParam = searchParams.get("total");
        const cartParam = searchParams.get("cart");
        const orderTypeParam = searchParams.get("orderType");
        const phoneParam = searchParams.get("phone");

        if (totalParam) setTotal(parseInt(totalParam) || 0);
        if (cartParam) setCartData(cartParam);
        if (orderTypeParam) setOrderType(orderTypeParam);
        if (phoneParam) setPhoneNumber(phoneParam);

        return () => {
            mountedRef.current = false;
        };
    }, [searchParams]);

    // 뒤로가기 처리
    const handleBack = () => {
        router.push(`/points?cart=${cartData}&total=${total}&orderType=${orderType}`);
    };

    // 카드 결제 처리
    const handleCardPayment = async () => {
        console.log("카드 결제 처리 시작");
        const msg = "카드 결제를 선택하셨습니다. 결제가 완료되었습니다.";
        setAssistantMessage(msg);
        console.log("음성 합성 시작");

        // 음성 합성과 페이지 이동을 동시에 시작
        const speakPromise = speakKorean(msg).catch(error => {
            console.error("음성 합성 에러:", error);
        });

        // 1초 후에 강제로 페이지 이동 (음성이 끝나든 말든)
        setTimeout(() => {
            console.log("타임아웃으로 페이지 이동");
            router.push("/");
        }, 1000);

        // 음성이 끝나면 즉시 페이지 이동 시도
        try {
            await speakPromise;
            console.log("음성 합성 완료");
            // 음성이 끝났어도 이미 타임아웃으로 이동했으므로 추가 이동은 하지 않음
        } catch (error) {
            console.error("음성 합성 대기 중 에러:", error);
        }
    };

    // 페이 결제 처리
    const handlePayPayment = async () => {
        console.log("페이 결제 처리 시작");
        const msg = "페이 결제를 선택하셨습니다. 결제가 완료되었습니다.";
        setAssistantMessage(msg);
        console.log("음성 합성 시작");

        // 음성 합성과 페이지 이동을 동시에 시작
        const speakPromise = speakKorean(msg).catch(error => {
            console.error("음성 합성 에러:", error);
        });

        // 1초 후에 강제로 페이지 이동 (음성이 끝나든 말든)
        setTimeout(() => {
            console.log("타임아웃으로 페이지 이동");
            router.push("/");
        }, 1000);

        // 음성이 끝나면 즉시 페이지 이동 시도
        try {
            await speakPromise;
            console.log("음성 합성 완료");
            // 음성이 끝났어도 이미 타임아웃으로 이동했으므로 추가 이동은 하지 않음
        } catch (error) {
            console.error("음성 합성 대기 중 에러:", error);
        }
    };

    // 페이지 진입 시 즉시 음성 안내
    useEffect(() => {
        // 이전 음성 안내 정리
        if (typeof window !== "undefined") {
            try {
                if (window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                }
            } catch (e) {
                console.log("SpeechSynthesis 정리 중 오류:", e);
            }
        }

        // 약간의 딜레이 후 음성 안내
        const timer = setTimeout(() => {
            const msg = "카드결제, 페이결제 중 선택해주세요.";
            setAssistantMessage(msg);
            speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    // 음성 인식 초기화
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
        recognitionRef.current = recognition;

        recognition.onstart = async () => {
            setIsListening(true);
        };

        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.log("음성인식 재시작 실패:", e);
                    }
                }, 500);
            }
        };

        recognition.onerror = (event) => {
            // "aborted"와 "no-speech"는 정상적인 동작이므로 무시
            if (event.error !== "aborted" && event.error !== "no-speech") {
                console.error("음성인식 오류:", event.error);
            }
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.replaceAll(" ", "").toLowerCase();
            
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

            console.log("🎤 결제 페이지 음성 인식:", transcript, "normalized:", normalized);

            // 카드결제 인식 - 더 정확한 키워드 매칭
            if (/카드|카드결제|카드로|카드로결제|card/.test(normalized)) {
                console.log("✅ 카드결제 인식됨");
                try {
                    recognition.stop();
                } catch (e) {
                    console.log("음성 인식 중지 오류:", e);
                }
                handleCardPayment();
                return;
            }
            
            // 페이결제 인식 - 더 정확한 키워드 매칭
            if (/페이|페이결제|페이로|페이로결제|pay|모바일페이/.test(normalized)) {
                console.log("✅ 페이결제 인식됨");
                try {
                    recognition.stop();
                } catch (e) {
                    console.log("음성 인식 중지 오류:", e);
                }
                handlePayPayment();
                return;
            }
            
            // 뒤로가기 인식
            if (/뒤로|뒤로가기|back/.test(normalized)) {
                try {
                    recognition.stop();
                } catch (e) {
                    console.log("음성 인식 중지 오류:", e);
                }
                handleBack();
                return;
            }
            
            // 인식되지 않은 경우 안내 메시지 (안내만 하고 음성 인식은 계속)
            const msg = "카드결제 또는 페이결제를 말씀해주세요.";
            setAssistantMessage(msg);
            speakKorean(msg).catch(err => console.error("음성 안내 오류:", err));
        };

        // 음성인식 시작
        try {
            recognition.start();
        } catch (e) {
            console.log("음성인식 시작 실패:", e);
        }

        return () => {
            mountedRef.current = false;
            try {
                recognition.stop();
            } catch (e) {
                console.log("음성인식 정지 실패:", e);
            }
        };
    }, []);

    const formatPhoneNumber = (phone) => {
        if (!phone || phone.length < 10) return phone;
        if (phone.length === 10) {
            return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
        } else if (phone.length === 11) {
            return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
        }
        return phone;
    };

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: "#f9f9f9",
                padding: "20px",
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
            {/* 상단 바 */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    backgroundColor: "#fff",
                    borderRadius: "12px",
                    marginBottom: "20px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
            >
                <button
                    onClick={handleBack}
                    style={{
                        padding: "12px 16px",
                        backgroundColor: "#6c757d",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "1rem",
                        cursor: "pointer",
                    }}
                >
                    ← 뒤로가기
                </button>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
                    결제하기
                </div>
                <div style={{ width: "100px" }}></div> {/* 균형 맞춤용 */}
            </div>

            {/* 메인 컨텐츠 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "40px",
                }}
            >
                {/* 주문 정보 */}
                <div
                    style={{
                        backgroundColor: "#fff",
                        padding: "24px",
                        borderRadius: "16px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                        width: "100%",
                        maxWidth: "500px",
                    }}
                >
                    <h2 style={{ margin: "0 0 16px 0", textAlign: "center" }}>
                        결제 정보
                    </h2>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <span>총 금액:</span>
                        <span style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
                            {total.toLocaleString()}원
                        </span>
                    </div>
                    {phoneNumber && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                            <span>적립 번호:</span>
                            <span>{formatPhoneNumber(phoneNumber)}</span>
                        </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>주문 유형:</span>
                        <span>{orderType === "dinein" ? "매장" : "포장"}</span>
                    </div>
                </div>

                {/* 결제 방법 선택 */}
                <div
                    style={{
                        display: "flex",
                        gap: "20px",
                        width: "100%",
                        maxWidth: "500px",
                    }}
                >
                    <button
                        onClick={handleCardPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            backgroundColor: "#007bff",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            cursor: "pointer",
                            transition: "transform 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        💳 카드결제
                    </button>

                    <button
                        onClick={handlePayPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            backgroundColor: "#28a745",
                            color: "#fff",
                            border: "none",
                            borderRadius: "16px",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            cursor: "pointer",
                            transition: "transform 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        📱 페이결제
                    </button>
                </div>

                {/* 음성 안내 메시지 - 고정 */}
                <div
                    style={{
                        backgroundColor: "#fff",
                        padding: "16px 24px",
                        borderRadius: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        maxWidth: "500px",
                        width: "100%",
                        textAlign: "center",
                        border: "2px solid #1e7a39",
                    }}
                >
                    <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "#1e7a39" }}>
                        {isListening && "🎤 "} {assistantMessage || "카드결제, 페이결제 중 선택해주세요."}
                    </p>
                </div>
            </div>
        </main>
    );
}
