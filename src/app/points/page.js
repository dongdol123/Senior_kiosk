"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

function PointsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [cartData, setCartData] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);
    const showPhoneModalRef = useRef(false);
    const phoneNumberRef = useRef("");

    useEffect(() => {
        const totalParam = searchParams.get("total");
        const orderTypeParam = searchParams.get("orderType");
        const cartParam = searchParams.get("cart") || "";
        const phoneParam = searchParams.get("phone") || "";

        if (totalParam) {
            const totalValue = parseInt(totalParam);
            setTotal(totalValue);
        }
        if (orderTypeParam) {
            setOrderType(orderTypeParam);
        }
        setCartData(cartParam);
        setPhoneNumber(phoneParam);

        if (cartParam) {
            try {
                setCartItems(JSON.parse(decodeURIComponent(cartParam)));
            } catch {
                setCartItems([]);
            }
        } else {
            setCartItems([]);
        }
    }, [searchParams]);

    useEffect(() => {
        showPhoneModalRef.current = showPhoneModal;
    }, [showPhoneModal]);

    useEffect(() => {
        phoneNumberRef.current = phoneNumber;
    }, [phoneNumber]);

    function convertKoreanNumberToDigit(text) {
        const koreanNumbers = {
            "공": "0", "영": "0", "제로": "0",
            "일": "1", "하나": "1", "한": "1",
            "이": "2", "둘": "2",
            "삼": "3", "셋": "3",
            "사": "4", "넷": "4",
            "오": "5", "다섯": "5",
            "육": "6", "륙": "6", "여섯": "6",
            "칠": "7", "일곱": "7",
            "팔": "8", "여덟": "8",
            "구": "9", "아홉": "9"
        };
        let result = "";
        const normalized = text.toLowerCase().replace(/\s/g, "");

        for (let i = 0; i < normalized.length; i++) {
            let found = false;
            for (const [korean, digit] of Object.entries(koreanNumbers)) {
                if (normalized.slice(i).startsWith(korean)) {
                    result += digit;
                    i += korean.length - 1;
                    found = true;
                    break;
                }
            }
            if (!found && /[0-9]/.test(normalized[i])) {
                result += normalized[i];
            }
        }
        return result;
    }

    function extractNumbersFromSpeech(text) {
        let numbers = text.replace(/[^0-9일이삼사오육칠팔구공영]/g, "");
        if (/[일이삼사오육칠팔구공영]/.test(text)) {
            numbers = convertKoreanNumberToDigit(text);
        }
        return numbers;
    }

    function formatPhoneNumber(value) {
        if (value.length <= 3) return value;
        if (value.length <= 7) return `${value.slice(0, 3)}-${value.slice(3)}`;
        if (value.length <= 10) return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
        return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
    }

    function handleNumberClick(num) {
        if (phoneNumber.length < 11) {
            setPhoneNumber((prev) => prev + String(num));
        }
    }

    function handleDelete() {
        setPhoneNumber((prev) => prev.slice(0, -1));
    }

    function handle010() {
        if (phoneNumber.length === 0) {
            setPhoneNumber("010");
        } else if (phoneNumber.length < 8) {
            setPhoneNumber((prev) => prev + "010");
        }
    }

    function openPhoneModal() {
        setShowPhoneModal(true);
    }

    function closePhoneModal() {
        setShowPhoneModal(false);
    }

    function confirmPhoneModal() {
        const currentPhone = phoneNumberRef.current || phoneNumber;
        if (currentPhone.length < 10) {
            alert("올바른 핸드폰 번호를 입력해주세요.");
            return;
        }
        setShowPhoneModal(false);
    }

    async function handleCardPayment() {
        const msg = "카드 결제를 선택하셨습니다. 결제가 완료되었습니다.";
        setAssistantMessage(msg);
        speakKorean(msg).catch(() => {});
        setTimeout(() => {
            router.push("/");
        }, 1000);
    }

    async function handlePayPayment() {
        const msg = "페이 결제를 선택하셨습니다. 결제가 완료되었습니다.";
        setAssistantMessage(msg);
        speakKorean(msg).catch(() => {});
        setTimeout(() => {
            router.push("/");
        }, 1000);
    }

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
            if (firstStartRef.current) {
                firstStartRef.current = false;
                const greeting = "핸드폰으로 적립하거나 결제 방법을 선택해주세요.";
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

            if (/적립|핸드폰|번호|포인트/.test(normalized)) {
                setShowPhoneModal(true);
                const msg = "번호를 입력해 적립할 수 있어요.";
                setAssistantMessage(msg);
                speakKorean(msg).catch(() => {});
                return;
            }

            if (/카드|카드결제|card/.test(normalized)) {
                try { recognition.stop(); } catch {}
                handleCardPayment();
                return;
            }

            if (/페이|pay|카카오|네이버/.test(normalized)) {
                try { recognition.stop(); } catch {}
                handlePayPayment();
                return;
            }

            if (showPhoneModalRef.current) {
                const extracted = extractNumbersFromSpeech(transcript);
                if (extracted.length > 0) {
                    setPhoneNumber((prev) => (prev + extracted).slice(0, 11));
                    const msg = `${extracted} 입력했습니다.`;
                    setAssistantMessage(msg);
                    speakKorean(msg).catch(() => {});
                    return;
                }
                if (/확인|완료/.test(normalized)) {
                    confirmPhoneModal();
                    return;
                }
            }

            const msg = "핸드폰으로 적립하거나 카드, 페이를 선택해주세요.";
            setAssistantMessage(msg);
            speakKorean(msg).catch(() => {});
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
        router.push(`/order-confirm?cart=${cartData}&total=${total}&orderType=${orderType}`);
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
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 24px",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
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

                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        backgroundColor: isListening ? "#e6f4ea" : "#eee",
                        color: isListening ? "#1e7a39" : "#777",
                        border: isListening ? "1px solid #bfe3ca" : "1px solid #ddd",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: "bold",
                        opacity: isListening ? 1 : 0.85,
                    }}
                >
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: isListening ? "#34c759" : "#bbb" }} />
                    {isListening ? "음성 주문중" : "간편 모드"}
                </div>
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
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "20%",
                        right: "20%",
                        height: "2px",
                        backgroundColor: "#999",
                        zIndex: 0,
                    }} />

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
                        }}>1</div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>메뉴 선택</div>
                    </div>

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
                        }}>2</div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>적립 및 결제</div>
                    </div>

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
                        }}>3</div>
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
                    justifyContent: "center",
                    padding: "40px 20px",
                    gap: "30px",
                    maxWidth: "800px",
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                <div style={{ width: "100%", maxWidth: "800px", textAlign: "left" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "700", color: "#1e7a39", marginBottom: "14px" }}>
                        포인트적립
                    </div>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                        <button
                            onClick={openPhoneModal}
                            style={{
                                width: "320px",
                                maxWidth: "100%",
                                padding: "18px 22px",
                                fontSize: "1.2rem",
                                fontWeight: "700",
                                backgroundColor: "#FEE500",
                                color: "#000",
                                border: "none",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            }}
                        >
                            핸드폰번호로 적립하기
                        </button>
                        <button
                            onClick={() => {}}
                            style={{
                                width: "320px",
                                maxWidth: "100%",
                                padding: "18px 22px",
                                fontSize: "1.2rem",
                                fontWeight: "700",
                                backgroundColor: "#9e9e9e",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "12px",
                                cursor: "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            }}
                        >
                            바코드로 적립하기
                        </button>
                    </div>
                </div>

                <div style={{ width: "100%", maxWidth: "800px", fontSize: "2rem", fontWeight: "700", color: "#1e7a39", textAlign: "left" }}>
                    결제 방법을 선택해주세요!
                </div>

                {/* 하단: 결제 방법 */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "20px",
                        width: "100%",
                        maxWidth: "800px",
                    }}
                >
                    <button
                        onClick={handleCardPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "1px solid #ddd",
                            borderRadius: "12px",
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
                            <div style={{ width: "60%", height: "2px", backgroundColor: "#000" }}></div>
                            <div style={{ width: "60%", height: "2px", backgroundColor: "#000" }}></div>
                        </div>
                        <div>신용카드</div>
                    </button>

                    <button
                        onClick={handlePayPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "1px solid #ddd",
                            borderRadius: "12px",
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
                        <div style={{
                            display: "flex",
                            gap: "16px",
                            alignItems: "center",
                        }}>
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

                    <button
                        onClick={handlePayPayment}
                        style={{
                            flex: 1,
                            padding: "40px 20px",
                            fontSize: "1.8rem",
                            fontWeight: "700",
                            backgroundColor: "#ffffff",
                            color: "#000000",
                            border: "1px solid #ddd",
                            borderRadius: "12px",
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
                        <img
                            src="/coupon.png"
                            alt="쿠폰 결제"
                            style={{ width: "90px", height: "90px", objectFit: "contain", display: "block" }}
                        />
                        <div>쿠폰</div>
                    </button>
                </div>

                {/* 하단: 메뉴/세트 구성 안내 */}
                <div
                    style={{
                        width: "100%",
                        backgroundColor: "#111111",
                        color: "#ffffff",
                        borderRadius: "12px",
                        padding: "16px 18px",
                    }}
                >
                    <div style={{ fontSize: "1rem", fontWeight: "700", marginBottom: "10px" }}>
                        주문 내역
                    </div>
                    {cartItems.length === 0 ? (
                        <div style={{ color: "#cccccc", fontSize: "0.95rem" }}>주문 정보가 없습니다.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {cartItems.map((item, idx) => (
                                <div key={`${item.id || item.name}-${idx}`} style={{ borderTop: idx === 0 ? "none" : "1px solid #2a2a2a", paddingTop: idx === 0 ? 0 : "10px" }}>
                                    <div style={{ fontSize: "1rem", fontWeight: "700" }}>
                                        {item.name}{item.qty > 1 ? ` x${item.qty}` : ""} - {(item.price * (item.qty || 1)).toLocaleString()}원
                                    </div>
                                    {item.type === "set" && Array.isArray(item.items) && item.items.length > 0 && (
                                        <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#d0d0d0" }}>
                                            {item.items
                                                .map((setItem) => {
                                                    const name = setItem.size ? `${setItem.name}(${setItem.size})` : setItem.name;
                                                    const price = typeof setItem.price === "number" ? ` ${setItem.price.toLocaleString()}원` : "";
                                                    return `${name}${price}`;
                                                })
                                                .join(" + ")}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showPhoneModal && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 2000,
                    }}
                    onClick={closePhoneModal}
                >
                    <div
                        style={{
                            width: "90%",
                            maxWidth: "760px",
                            background: "#fff",
                            borderRadius: "16px",
                            padding: "20px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                            <div style={{ fontSize: "1.3rem", fontWeight: "700" }}>휴대폰 번호 입력</div>
                            <button onClick={closePhoneModal} style={{ background: "transparent", border: "none", fontSize: "1.4rem", cursor: "pointer" }}>x</button>
                        </div>

                        <div style={{ borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "16px", textAlign: "center", fontSize: "2rem", fontWeight: "700" }}>
                            {phoneNumber.length ? formatPhoneNumber(phoneNumber) : "전화번호 입력"}
                        </div>

                        <div style={{ display: "flex", gap: "12px" }}>
                            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                                {[7,8,9,4,5,6,1,2,3,0].map((n) => (
                                    <button key={n} onClick={() => handleNumberClick(n)} style={{ height: "62px", fontSize: "1.4rem", fontWeight: "700", border: "1px solid #ddd", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>
                                        {n}
                                    </button>
                                ))}
                                <button onClick={handle010} style={{ height: "62px", gridColumn: "span 2", fontSize: "1.1rem", fontWeight: "700", border: "1px solid #ddd", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>
                                    010
                                </button>
                            </div>
                            <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <button onClick={handleDelete} style={{ height: "62px", border: "1px solid #ddd", borderRadius: "8px", background: "#fff", cursor: "pointer", fontWeight: "700" }}>
                                    지움
                                </button>
                                <button onClick={confirmPhoneModal} disabled={phoneNumber.length < 10} style={{ flex: 1, border: "none", borderRadius: "8px", background: phoneNumber.length >= 10 ? "#ff0000" : "#bbb", color: "#fff", cursor: phoneNumber.length >= 10 ? "pointer" : "not-allowed", fontWeight: "700" }}>
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default function PointsPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }} />}>
            <PointsPageContent />
        </Suspense>
    );
}

