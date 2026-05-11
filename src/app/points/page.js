"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import KioskProgressBars from "../../components/KioskProgressBars";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

function PointsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [cartData, setCartData] = useState("");
    const [cartItems, setCartItems] = useState([]);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [couponCode, setCouponCode] = useState("");
    const [showCouponModal, setShowCouponModal] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const [isBackButtonActive, setIsBackButtonActive] = useState(false);
    const [isPhoneRewardButtonActive, setIsPhoneRewardButtonActive] = useState(false);
    const [isPhoneCancelButtonActive, setIsPhoneCancelButtonActive] = useState(false);
    const [isPhoneConfirmButtonActive, setIsPhoneConfirmButtonActive] = useState(false);
    const [isPhoneRewardCompleted, setIsPhoneRewardCompleted] = useState(false);
    const [isCouponCancelButtonActive, setIsCouponCancelButtonActive] = useState(false);
    const [activePaymentButton, setActivePaymentButton] = useState("");
    const [activeDialButton, setActiveDialButton] = useState("");
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);
    const showPhoneModalRef = useRef(false);
    const phoneNumberRef = useRef("");
    const shouldListenRef = useRef(true);
    const isSpeakingRef = useRef(false);

    function navigateTo(path) {
        stopVoiceSession(recognitionRef.current);
        router.push(path);
    }

    async function speakAndResume(msg) {
        setAssistantMessage(msg);
        shouldListenRef.current = false;
        isSpeakingRef.current = true;
        try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
        await speakKorean(msg).catch(() => {});
        isSpeakingRef.current = false;
        shouldListenRef.current = true;
        setTimeout(() => {
            if (!mountedRef.current || !shouldListenRef.current || isSpeakingRef.current) return;
            try { recognitionRef.current && recognitionRef.current.start(); } catch {}
        }, 1000);
    }

    function handleCardPaymentClick() {
        setActivePaymentButton("card");
        handleCardPayment();
    }

    function handlePayPaymentClick() {
        setActivePaymentButton("pay");
        handlePayPayment();
    }

    function handleCouponPaymentClick() {
        setActivePaymentButton("coupon");
        setActiveDialButton("");
        setCouponCode("");
        setShowCouponModal(true);
    }

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

    function flashDialButton(key, action) {
        setActiveDialButton(String(key));
        setTimeout(() => {
            action();
            setActiveDialButton("");
        }, 120);
    }

    function flashAction(setActive, action) {
        setActive(true);
        setTimeout(() => {
            action();
            setActive(false);
        }, 120);
    }

    function openPhoneModal() {
        shouldListenRef.current = false;
        try { recognitionRef.current && recognitionRef.current.stop(); } catch {}
        setCouponCode("");
        setActiveDialButton("");
        setShowPhoneModal(true);
    }

    function closePhoneModal() {
        setShowPhoneModal(false);
        setActiveDialButton("");
        shouldListenRef.current = true;
        setTimeout(() => {
            if (!mountedRef.current || !shouldListenRef.current || isSpeakingRef.current) return;
            try { recognitionRef.current && recognitionRef.current.start(); } catch {}
        }, 300);
    }

    function confirmPhoneModal() {
        const currentPhone = phoneNumberRef.current || phoneNumber;
        if (currentPhone.length < 10) {
            alert("올바른 핸드폰 번호를 입력해주세요.");
            return;
        }
        setIsPhoneRewardCompleted(true);
        setShowPhoneModal(false);
    }

    function handleCouponNumberClick(num) {
        setCouponCode((prev) => (prev.length < 16 ? prev + String(num) : prev));
    }

    function handleCouponDelete() {
        setCouponCode((prev) => prev.slice(0, -1));
    }

    function formatCouponCode(value) {
        return value.replace(/(\d{4})(?=\d)/g, "$1-");
    }

    function closeCouponModal() {
        setShowCouponModal(false);
        setActiveDialButton("");
        setActivePaymentButton("");
    }

    function confirmCouponModal() {
        if (couponCode.length < 16) return;
        setShowCouponModal(false);
        navigateTo(entry === "qr" ? "/qr-order" : "/");
    }

    function clearOrderFlowFlags() {
        try {
            if (typeof window !== "undefined") {
                window.sessionStorage.removeItem("menuGreetingPlayed");
            }
        } catch { }
    }

    // 안내 음성이 끝까지 재생된 뒤 홈으로 이동 (안전장치 6초)
    async function speakThenGoHome(msg) {
        setAssistantMessage(msg);
        shouldListenRef.current = false;
        isSpeakingRef.current = true;
        try { recognitionRef.current && recognitionRef.current.stop(); } catch {}

        const speakDone = speakKorean(msg).catch(() => {});
        const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 6000));
        await Promise.race([speakDone, safetyTimeout]);
        // 마지막 발음이 잘리지 않도록 짧은 여유
        await new Promise((resolve) => setTimeout(resolve, 300));

        isSpeakingRef.current = false;
        clearOrderFlowFlags();
        navigateTo(entry === "qr" ? "/qr-order" : "/");
    }

    async function handleCardPayment() {
        await speakThenGoHome("카드를 넣어주세요.");
    }

    async function handlePayPayment() {
        await speakThenGoHome("바코드를 찍어주세요.");
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
                await speakAndResume(greeting);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current && shouldListenRef.current && !isSpeakingRef.current) {
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current || isSpeakingRef.current) return;
                    try { recognition.start(); } catch { }
                }, 300);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = async (event) => {
            if (isTtsActive()) {
                return;
            }
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
                await speakAndResume(msg);
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
                    await speakAndResume(msg);
                    return;
                }
                if (/확인|완료/.test(normalized)) {
                    confirmPhoneModal();
                    return;
                }
            }

            const msg = "핸드폰으로 적립하거나 카드, 페이를 선택해주세요.";
            await speakAndResume(msg);
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

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
        setIsBackButtonActive(true);
        const enc = encodeURIComponent(JSON.stringify(cartItems));
        setTimeout(() => {
            navigateTo(`/menu?${entryQuery(entry)}&orderType=${orderType}&cart=${enc}`);
        }, 120);
    }

    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: entry === "qr" ? "100%" : "100vh",
                height: entry === "qr" ? "100%" : "100dvh",
                maxHeight: entry === "qr" ? "100%" : "100dvh",
                flex: entry === "qr" ? 1 : undefined,
                backgroundColor: "#ffffff",
                overflow: "hidden",
            }}
        >
            {/* 음성 인식 로그창 - 항상 표시 */}
            <div
                style={{
                    display: "none",
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
                    padding: "16px 24px",
                    backgroundColor: "#fff",
                    zIndex: 50,
                }}
            >
                <button
                    onClick={handleBack}
                    style={{
                        backgroundColor: isBackButtonActive ? "#fec315" : "#002e55",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "18px",
                        fontWeight: "600",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                    }}
                >
                    <img
                        src="/back.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
                    뒤로가기
                </button>

                <div style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <img
                        src="/logo.png"
                        alt="logo"
                        style={{
                            width: "64px",
                            height: "64px",
                            objectFit: "contain",
                            display: "block",
                            marginTop: "4px",
                        }}
                    />
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

            <KioskProgressBars activeIndex={2} />

            {/* 메인 컨텐츠 */}
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    padding: "36px 20px 12px",
                    gap: "16px",
                    maxWidth: "800px",
                    width: "100%",
                    margin: "0 auto",
                    overflow: "hidden",
                    transform: "translateY(-16px)",
                }}
            >
                <div
                    style={{
                        display: "block",
                        width: "100%",
                        background: "#f5f8fc",
                        color: "#000000",
                        border: "2px solid #d9e3ef",
                        borderRadius: "12px",
                        padding: "16px 18px",
                        height: "400px",
                        boxSizing: "border-box",
                        marginTop: "0",
                        marginBottom: "44px",
                    }}
                >
                    <div style={{ fontSize: "2.2rem", fontWeight: "700", marginBottom: "14px" }}>
                        주문 내역
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", height: "calc(100% - 52px)", background: "#f5f8fc" }}>
                    {cartItems.length === 0 ? (
                        <div style={{ color: "#000000", fontSize: "0.95rem", background: "#f5f8fc" }}>주문 정보가 없습니다.</div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", overflowX: "hidden", paddingRight: "4px", paddingBottom: "12px", boxSizing: "border-box", background: "#f5f8fc" }}>
                            {cartItems.map((item, idx) => (
                                <div key={`${item.id || item.name}-${idx}`} style={{ borderTop: idx === 0 ? "none" : "2px solid #d9e3ef", paddingTop: idx === 0 ? 0 : "10px", background: "#f5f8fc" }}>
                                    <div style={{ fontSize: "1.35rem", fontWeight: "700", lineHeight: 1.3 }}>
                                        {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""} | {(item.price * (item.qty || 1)).toLocaleString()}원                                        
                                    </div>
                                    {false && item.type === "set" && Array.isArray(item.items) && item.items.length > 0 && (
                                        <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#000000" }}>
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
                        <div style={{ marginTop: "12px", textAlign: "right", fontSize: "2.2rem", fontWeight: "700", color: "#000000", background: "#f5f8fc", paddingRight: "4px", paddingBottom: "8px", boxSizing: "border-box" }}>
                            총 금액 | {cartItems.reduce((sum, item) => sum + item.price * (item.qty || 1), 0).toLocaleString()}원
                        </div>
                    </div>
                </div>

                <div style={{ width: "100%", maxWidth: "800px", textAlign: "left", marginTop: "0", marginBottom: "44px" }}>
                    <div style={{ fontSize: "2.2rem", fontWeight: "700", color: "#000000", marginBottom: "14px" }}>
                        포인트 적립하기
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            position: "relative",
                            zIndex: 2,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => flashAction(setIsPhoneRewardButtonActive, openPhoneModal)}
                            style={{
                                width: "360px",
                                maxWidth: "100%",
                                padding: "18px 24px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: isPhoneRewardButtonActive ? "#fec315" : "#002e55",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "12px",
                                cursor: "pointer",
                                position: "relative",
                                zIndex: 2,
                            }}
                        >
                            {isPhoneRewardCompleted ? "휴대폰 번호로 적립 완료" : "휴대폰 번호로 적립하기"}
                        </button>
                    </div>
                </div>

                <div style={{ width: "100%", marginTop: "0", maxWidth: "800px", fontSize: "2.2rem", fontWeight: "700", color: "#000000", textAlign: "left" }}>
                    결제 수단을 선택해주세요
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
                        onClick={handleCardPaymentClick}
                        style={{
                            flex: 1,
                            padding: "33px 20px 23px",
                            fontSize: "1.95rem",
                            fontWeight: "700",
                            backgroundColor: activePaymentButton === "card" ? "#c8d8ea" : "#f5f8fc",
                            color: "#000000",
                            border: activePaymentButton === "card" ? "2px solid #002e55" : "2px solid #d9e3ef",
                            borderRadius: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            boxShadow: activePaymentButton === "card" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                        }}
                    >
                        <img
                            src="/creditcard.png"
                            alt="신용카드 결제"
                            style={{ width: "auto", height: "65px", objectFit: "contain", display: "block" }}
                        />
                        <div>신용카드</div>
                    </button>

                    <button
                        onClick={handlePayPaymentClick}
                        style={{
                            flex: 1,
                            padding: "33px 20px 23px",
                            fontSize: "1.95rem",
                            fontWeight: "700",
                            backgroundColor: activePaymentButton === "pay" ? "#c8d8ea" : "#f5f8fc",
                            color: "#000000",
                            border: activePaymentButton === "pay" ? "2px solid #002e55" : "2px solid #d9e3ef",
                            borderRadius: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            boxShadow: activePaymentButton === "pay" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                        }}
                    >
                        <img
                            src="/pay.png"
                            alt="페이 결제"
                            style={{ width: "auto", height: "65px", objectFit: "contain", display: "block" }}
                        />
                        <div style={{
                            display: "none",
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
                        onClick={handleCouponPaymentClick}
                        style={{
                            flex: 1,
                            padding: "33px 20px 23px",
                            fontSize: "1.95rem",
                            fontWeight: "700",
                            backgroundColor: activePaymentButton === "coupon" ? "#c8d8ea" : "#f5f8fc",
                            color: "#000000",
                            border: activePaymentButton === "coupon" ? "2px solid #002e55" : "2px solid #d9e3ef",
                            borderRadius: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "12px",
                            boxShadow: activePaymentButton === "coupon" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)",
                        }}
                    >
                        <img
                            src="/coupon.png"
                            alt="쿠폰 결제"
                            style={{ width: "auto", height: "65px", objectFit: "contain", display: "block" }}
                        />
                        <div>쿠폰</div>
                    </button>
                </div>

                {/* 하단: 메뉴/세트 구성 안내 */}
                <div
                    style={{
                        display: "none",
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
                                    <div style={{ fontSize: "0.9rem", fontWeight: "700" }}>
                                        {item.name}{item.qty > 1 ? ` ×${item.qty}` : ""} - {(item.price * (item.qty || 1)).toLocaleString()}원
                                    </div>
                                    {false && item.type === "set" && Array.isArray(item.items) && item.items.length > 0 && (
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
                            maxWidth: "650px",
                            background: "#fff",
                            borderRadius: "16px",
                            padding: "20px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        </div>

                        <div
                            style={{
                                borderBottom: "2px solid #333",
                                paddingBottom: "10px",
                                marginBottom: "16px",
                                textAlign: "center",
                                fontSize: "2.5rem",
                                fontWeight: "700",
                                color: "#000000",
                                minHeight: "62px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {phoneNumber.length ? formatPhoneNumber(phoneNumber) : "휴대폰 번호 입력"}
                        </div>

                        <div style={{ display: "flex", gap: "16px" }}>
                            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                                {[7,8,9,4,5,6,1,2,3,0].map((n) => (
                                    <button key={n} onClick={() => flashDialButton(n, () => handleNumberClick(n))} style={{ height: "120px", fontSize: "3rem", fontWeight: "700", border: activeDialButton === String(n) ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === String(n) ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", boxShadow: activeDialButton === String(n) ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                        {n}
                                    </button>
                                ))}
                                <button onClick={() => flashDialButton("010", handle010)} style={{ height: "120px", gridColumn: "span 2", fontSize: "3rem", fontWeight: "700", border: activeDialButton === "010" ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === "010" ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", boxShadow: activeDialButton === "010" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                    010
                                </button>
                            </div>
                            <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                <button onClick={() => flashDialButton("delete", handleDelete)} style={{ height: "120px", border: activeDialButton === "delete" ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === "delete" ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", fontWeight: "700", fontSize: "2rem", boxShadow: activeDialButton === "delete" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                    지움
                                </button>
                                <button onClick={() => phoneNumber.length >= 10 && flashAction(setIsPhoneConfirmButtonActive, confirmPhoneModal)} disabled={phoneNumber.length < 10} style={{ flex: 1, border: "none", borderRadius: "8px", background: phoneNumber.length < 10 ? "#bbb" : isPhoneConfirmButtonActive ? "#fec315" : "#ff0000", color: "#fff", cursor: phoneNumber.length >= 10 ? "pointer" : "not-allowed", fontWeight: "700", fontSize: "2rem" }}>
                                    확인
                                </button>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "18px" }}>
                            <button
                                onClick={() => flashAction(setIsPhoneCancelButtonActive, closePhoneModal)}
                                style={{
                                    width: "fit-content",
                                    padding: "14px 24px",
                                    fontSize: "1.5rem",
                                    fontWeight: "700",
                                    backgroundColor: isPhoneCancelButtonActive ? "#fec315" : "#002e55",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                                }}
                            >
                                취소하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCouponModal && (
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
                    onClick={closeCouponModal}
                >
                    <div
                        style={{
                            width: "90%",
                            maxWidth: "650px",
                            background: "#fff",
                            borderRadius: "16px",
                            padding: "20px",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        </div>

                        <div style={{ borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "16px", textAlign: "center", fontSize: "2.5rem", fontWeight: "700", position: "relative", color: "transparent" }}>
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#000000",
                                    background: "#ffffff",
                                }}
                            >
                                {couponCode.length ? formatCouponCode(couponCode) : "쿠폰 번호 16자리 입력"}
                            </div>
                            {couponCode.length ? couponCode : "쿠폰 번호 16자리 입력"}
                        </div>

                        <div style={{ display: "flex", gap: "16px" }}>
                            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                                {[7,8,9,4,5,6,1,2,3].map((n) => (
                                    <button key={`coupon-${n}`} onClick={() => flashDialButton(`coupon-${n}`, () => handleCouponNumberClick(n))} style={{ height: "120px", fontSize: "3rem", fontWeight: "700", border: activeDialButton === `coupon-${n}` ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === `coupon-${n}` ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", boxShadow: activeDialButton === `coupon-${n}` ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                        {n}
                                    </button>
                                ))}
                                <button onClick={() => flashDialButton("coupon-0", () => handleCouponNumberClick(0))} style={{ height: "120px", gridColumn: "span 3", fontSize: "3rem", fontWeight: "700", border: activeDialButton === "coupon-0" ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === "coupon-0" ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", boxShadow: activeDialButton === "coupon-0" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                    0
                                </button>
                            </div>
                            <div style={{ width: "120px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                <button onClick={() => flashDialButton("coupon-delete", handleCouponDelete)} style={{ height: "120px", border: activeDialButton === "coupon-delete" ? "2px solid #002e55" : "2px solid #d9e3ef", borderRadius: "12px", background: activeDialButton === "coupon-delete" ? "#c8d8ea" : "#f5f8fc", cursor: "pointer", fontWeight: "700", fontSize: "2rem", boxShadow: activeDialButton === "coupon-delete" ? "0 4px 10px rgba(0,0,0,0.12)" : "0 2px 6px rgba(0,0,0,0.06)" }}>
                                    지움
                                </button>
                                <button onClick={confirmCouponModal} disabled={couponCode.length < 16} style={{ flex: 1, border: "none", borderRadius: "8px", background: couponCode.length >= 16 ? "#ff0000" : "#bbb", color: "#fff", cursor: couponCode.length >= 16 ? "pointer" : "not-allowed", fontWeight: "700", fontSize: "2rem" }}>
                                    확인
                                </button>
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "18px" }}>
                            <button
                                onClick={() => flashAction(setIsCouponCancelButtonActive, closeCouponModal)}
                                style={{
                                    width: "fit-content",
                                    padding: "14px 24px",
                                    fontSize: "1.5rem",
                                    fontWeight: "700",
                                    backgroundColor: isCouponCancelButtonActive ? "#fec315" : "#002e55",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                                }}
                            >
                                취소하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function PointsPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#f9f9f9" }} />}>
            <PointsPageContent />
        </Suspense>
    );
}

