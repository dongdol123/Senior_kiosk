"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

function PaymentPageContent() {
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
        router.push(`/phone-input?cart=${cartData}&total=${total}&orderType=${orderType}`);
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

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
                backgroundColor: "#ffffff",
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
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 24px",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
                {/* 왼쪽: 뒤로가기 버튼 */}
                <button
                    onClick={handleBack}
                    style={{
                        backgroundColor: "#000000",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "600",
                    }}
                >
                    ← 뒤로가기
                </button>

                {/* 중앙: 연두햄버거 제목 */}
                <div style={{ 
                    fontSize: "24px", 
                    fontWeight: "700", 
                    color: "#1e7a39",
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                }}>
                    연두햄버거
                </div>

                {/* 오른쪽: 빈 공간 */}
                <div style={{ width: "120px" }}></div>
            </div>

            {/* Progress Bar */}
            <div
                style={{
                    flexShrink: 0,
                    backgroundColor: "#f5f5f5",
                    padding: "12px 24px",
                    borderBottom: "1px solid #e5e5e5",
                }}
            >
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "30px",
                    position: "relative",
                }}>
                    {/* 가로선 */}
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "15%",
                        right: "15%",
                        height: "2px",
                        backgroundColor: "#999",
                        zIndex: 0,
                    }} />
                    
                    {/* 진행된 부분의 가로선 (1단계에서 3단계까지) */}
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "15%",
                        width: "calc(60% - 15%)",
                        height: "2px",
                        backgroundColor: "#333",
                        zIndex: 1,
                    }} />
                    
                    {/* 1 메뉴 선택 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            1
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>메뉴 선택</div>
                    </div>

                    {/* 2 포인트 적립 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            2
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>포인트 적립</div>
                    </div>

                    {/* 3 결제하기 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#000000",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            3
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>결제하기</div>
                    </div>

                    {/* 4 완료 */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", zIndex: 1 }}>
                        <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "2px solid #999",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            4
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>완료</div>
                    </div>
                </div>
            </div>

            {/* 메인 컨텐츠 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    padding: "60px 40px 40px 40px",
                    gap: "40px",
                    backgroundColor: "#ffffff",
                }}
            >
                {/* 안내 문구 */}
                <div style={{
                    fontSize: "2rem",
                    fontWeight: "700",
                    color: "#000000",
                    textAlign: "center",
                    marginBottom: "20px",
                }}>
                    결제 방법을 선택해주세요
                </div>

                {/* 총 결제금액 바 */}
                <div style={{
                    width: "100%",
                    maxWidth: "600px",
                    backgroundColor: "#1e7a39",
                    padding: "28px 24px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}>
                    <div style={{
                        fontSize: "2rem",
                        fontWeight: "700",
                        color: "#ffffff",
                        textAlign: "center",
                    }}>
                        총 결제금액 | {total.toLocaleString()} 원
                    </div>
                </div>

                {/* 결제 방법 선택 버튼 */}
                <div style={{
                    width: "100%",
                    maxWidth: "600px",
                    display: "flex",
                    gap: "20px",
                }}>
                    {/* 신용카드 버튼 */}
                    <button
                        onClick={handleCardPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "1px solid #ddd",
                            borderRadius: "12px",
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "16px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                            e.currentTarget.style.borderColor = "#999";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.borderColor = "#ddd";
                        }}
                    >
                        {/* 카드 아이콘 */}
                        <div style={{
                            width: "80px",
                            height: "60px",
                            border: "2px solid #000",
                            borderRadius: "8px",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            padding: "8px",
                        }}>
                            <div style={{
                                width: "100%",
                                height: "20px",
                                border: "1px solid #000",
                                borderRadius: "2px",
                            }}></div>
                            <div style={{
                                width: "60%",
                                height: "2px",
                                backgroundColor: "#000",
                            }}></div>
                            <div style={{
                                width: "60%",
                                height: "2px",
                                backgroundColor: "#000",
                            }}></div>
                        </div>
                        <div>신용카드</div>
                    </button>

                    {/* 페이 버튼 */}
                    <button
                        onClick={handlePayPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "1px solid #ddd",
                            borderRadius: "12px",
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "16px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "#f5f5f5";
                            e.currentTarget.style.borderColor = "#999";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "#ffffff";
                            e.currentTarget.style.borderColor = "#ddd";
                        }}
                    >
                        {/* 페이 로고들 */}
                        <div style={{
                            display: "flex",
                            gap: "16px",
                            alignItems: "center",
                        }}>
                            {/* 네이버페이 스타일 */}
                            <div style={{
                                width: "80px",
                                height: "80px",
                                backgroundColor: "#03C75A",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: "700",
                            }}>
                                <div style={{ fontSize: "32px", fontWeight: "800" }}>N</div>
                                <div style={{ fontSize: "12px" }}>pay</div>
                            </div>
                            {/* 카카오페이 스타일 */}
                            <div style={{
                                width: "80px",
                                height: "80px",
                                backgroundColor: "#FEE500",
                                borderRadius: "10px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#000000",
                                fontSize: "12px",
                                fontWeight: "700",
                            }}>
                                <div style={{ fontSize: "36px" }}>💬</div>
                                <div style={{ fontSize: "12px" }}>pay</div>
                            </div>
                        </div>
                        <div>페이</div>
                    </button>
                </div>
            </div>
        </main>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
            <PaymentPageContent />
        </Suspense>
    );
}
