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
            if (firstStartRef.current) {
                firstStartRef.current = false;
                const greeting = "카드결제 또는 페이결제 중 선택해주세요.";
                setAssistantMessage(greeting);
                await speakKorean(greeting);
            }
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
            // "aborted"는 정상적인 중단이므로 무시
            if (event.error !== "aborted") {
                console.error("음성인식 오류:", event.error);
            }
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript || "";
            const normalized = transcript.replaceAll(" ", "").toLowerCase();

            if (normalized.includes("카드") || normalized.includes("card")) {
                handleCardPayment();
            } else if (normalized.includes("페이") || normalized.includes("pay")) {
                handlePayPayment();
            } else if (normalized.includes("뒤로") || normalized.includes("back")) {
                handleBack();
            } else {
                const msg = "카드결제 또는 페이결제를 말씀해주세요.";
                setAssistantMessage(msg);
                await speakKorean(msg);
            }
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

                {/* 음성 안내 메시지 */}
                {assistantMessage && (
                    <div
                        style={{
                            backgroundColor: "#fff",
                            padding: "16px 24px",
                            borderRadius: "12px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            maxWidth: "500px",
                            width: "100%",
                            textAlign: "center",
                        }}
                    >
                        <p style={{ margin: 0, fontSize: "1.1rem" }}>
                            {isListening && "🎤 "} {assistantMessage}
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
