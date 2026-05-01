"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { isTtsActive, speakKorean } from "../utils/speakKorean";
import { registerVoiceSession, stopVoiceSession } from "../utils/voiceSession";
import KioskAspectFrame from "../../components/KioskAspectFrame";
import KioskProgressBars from "../../components/KioskProgressBars";
import { getOrderFlowEntry, entryQuery } from "../utils/orderFlowEntry";

function PhoneInputPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const entry = getOrderFlowEntry(searchParams);
    const [phoneNumber, setPhoneNumber] = useState("");
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
    const [voiceLogs, setVoiceLogs] = useState([]);
    const [isHomeButtonActive, setIsHomeButtonActive] = useState(false);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);
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

    // ?レ옄 ?띿뒪?몃? ?レ옄濡?蹂??(?? "?쇨났?? -> "010", "怨듭씪怨? -> "010")
    function convertKoreanNumberToDigit(text) {
        const koreanNumbers = {
            "怨?: "0", "??: "0", "?쒕줈": "0",
            "??: "1", "?섎굹": "1", "??: "1",
            "??: "2", "??: "2",
            "??: "3", "??: "3",
            "??: "4", "??: "4",
            "??: "5", "?ㅼ꽢": "5",
            "??: "6", "瑜?: "6", "?ъ꽢": "6",
            "移?: "7", "?쇨낢": "7",
            "??: "8", "?щ뜜": "8",
            "援?: "9", "?꾪솄": "9"
        };
        
        let result = "";
        const normalized = text.toLowerCase().replace(/\s/g, "");
        
        // ?쒓? ?レ옄 ?⑦꽩 李얘린
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

    // ?뚯꽦 ?몄떇?쇰줈 ?レ옄 異붿텧
    function extractNumbersFromSpeech(text) {
        // ?レ옄留?異붿텧
        let numbers = text.replace(/[^0-9?쇱씠?쇱궗?ㅼ쑁移좏뙏援ш났??/g, "");
        
        // ?쒓? ?レ옄媛 ?덉쑝硫?蹂??
        if (/[?쇱씠?쇱궗?ㅼ쑁移좏뙏援ш났??/.test(text)) {
            numbers = convertKoreanNumberToDigit(text);
        }
        
        return numbers;
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
        
        // ?ъ빱??
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [searchParams]);

    useEffect(() => {
        phoneNumberRef.current = phoneNumber;
    }, [phoneNumber]);

    // ?뚯꽦 ?몄떇
    useEffect(() => {
        mountedRef.current = true;
        firstStartRef.current = true;
        shouldListenRef.current = true;

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
            // 泥섏쓬 ?쒖옉???뚮쭔 ?몄궗留?
            if (firstStartRef.current) {
                firstStartRef.current = false;
                const greeting = "?몃뱶??踰덊샇瑜??뚮윭二쇱꽭??;
                await speakAndResume(greeting);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            if (mountedRef.current && shouldListenRef.current && !isSpeakingRef.current) {
                setTimeout(() => {
                    if (!mountedRef.current || !shouldListenRef.current || isSpeakingRef.current) return;
                    try { recognition.start(); } catch {}
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
            
            // ?뚯꽦 ?몄떇 濡쒓렇 異붽?
            const normalized = transcript.toLowerCase().replace(/\s/g, "");
            const logEntry = {
                time: new Date().toLocaleTimeString('ko-KR'),
                transcript: transcript,
                normalized: normalized
            };
            setVoiceLogs((prev) => {
                const newLogs = [logEntry, ...prev].slice(0, 10);
                return newLogs;
            });
            
            // ?レ옄 異붿텧
            const extractedNumbers = extractNumbersFromSpeech(transcript);
            
            if (extractedNumbers.length > 0) {
                // ?꾩옱 踰덊샇??異붽? (理쒕? 11?먮━)
                setPhoneNumber(prev => {
                    const newNumber = prev + extractedNumbers;
                    return newNumber.slice(0, 11);
                });
                
                const msg = `${extractedNumbers} ?낅젰?덉뒿?덈떎.`;
                await speakAndResume(msg);
            } else {
                // "?뺤씤", "?꾨즺" ?깆쓽 紐낅졊 泥섎━
                const normalized = transcript.toLowerCase().replace(/\s/g, "");
                if (/?뺤씤|?꾨즺|寃곗젣|?곷┰/.test(normalized)) {
                    if ((phoneNumberRef.current || "").length >= 10) {
                        handleConfirm();
                    } else {
                        const msg = "?몃뱶??踰덊샇瑜?紐⑤몢 ?낅젰?댁＜?몄슂.";
                        await speakAndResume(msg);
                    }
                } else {
                    const msg = "踰덊샇瑜?留먯??댁＜?몄슂.";
                    await speakAndResume(msg);
                }
            }
        };

        recognitionRef.current = recognition;
        registerVoiceSession(recognition);

        try {
            recognition.start();
        } catch (e) {
            // 沅뚰븳 ?ㅻ쪟??臾댁떆
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

    function handlePhoneChange(e) {
        const value = e.target.value.replace(/[^0-9]/g, "");
        if (value.length <= 11) {
            setPhoneNumber(value);
        }
    }

    function formatPhoneNumber(value) {
        if (value.length <= 3) return value;
        if (value.length <= 7) return `${value.slice(0, 3)}-${value.slice(3)}`;
        if (value.length <= 10) return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
        return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7, 11)}`;
    }

    function handleNumberClick(num) {
        if (phoneNumber.length < 11) {
            setPhoneNumber(prev => prev + String(num));
        }
    }

    function handleDelete() {
        setPhoneNumber(prev => prev.slice(0, -1));
    }

    function handle010() {
        if (phoneNumber.length === 0) {
            setPhoneNumber("010");
        } else if (phoneNumber.length < 8) {
            setPhoneNumber(prev => prev + "010");
        }
    }

    function handleConfirm() {
        const currentPhone = phoneNumberRef.current || phoneNumber;
        if (currentPhone.length < 10) {
            alert("?щ컮瑜??몃뱶??踰덊샇瑜??낅젰?댁＜?몄슂.");
            return;
        }

        // 寃곗젣 ?섏씠吏濡??대룞
        const cartData = searchParams.get("cart");
        navigateTo(`/payment?cart=${cartData}&total=${total}&orderType=${orderType}&phone=${currentPhone}&${entryQuery(entry)}`);
    }

    function handleBack() {
        const cartData = searchParams.get("cart");
        navigateTo(`/points?cart=${cartData}&total=${total}&orderType=${orderType}&${entryQuery(entry)}`);
    }

    const shell = (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: entry === "qr" ? "100%" : "100vh",
                flex: entry === "qr" ? 1 : undefined,
                backgroundColor: "#ffffff",
            }}
        >
            {/* ?뚯꽦 ?몄떇 濡쒓렇李?- ??긽 ?쒖떆 */}
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
                    ?렎 ?뚯꽦 ?몄떇 濡쒓렇
                </div>
                {voiceLogs.length === 0 ? (
                    <div style={{ color: "#999", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                        ?뚯꽦 ?몄떇 ?湲?以?..
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
                                    (?뺢퇋?? {log.normalized})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ?곷떒 ?ㅻ뜑 */}
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
                {/* ?쇱そ: 泥섏쓬?쇰줈 踰꾪듉 */}
                <button
                    onClick={() => {
                        setIsHomeButtonActive(true);
                        setTimeout(() => {
                            try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                            try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                            navigateTo(entry === "qr" ? "/qr-order" : "/");
                        }, 120);
                    }}
                    style={{
                        backgroundColor: isHomeButtonActive ? "#fec315" : "#002e55",
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
                        src="/home.png"
                        alt=""
                        aria-hidden="true"
                        style={{ width: "22px", height: "22px", objectFit: "contain" }}
                    />
                    泥섏쓬?쇰줈
                </button>

                {/* 以묒븰: ?곕몢?꾨쾭嫄??쒕ぉ */}
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

                {/* ?ㅻⅨ履? 鍮?怨듦컙 */}
                <div style={{ width: "100px" }}></div>
            </div>

            <KioskProgressBars activeIndex={2} />

            {/* 硫붿씤 而⑦뀗痢?*/}
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
                {/* ?덈궡 臾멸뎄 */}
                <div style={{
                    fontSize: "2rem",
                    fontWeight: "700",
                    color: "#000000",
                    textAlign: "center",
                    marginBottom: "20px",
                }}>
                    ?ъ씤???곷┰???꾪빐 ?꾪솕踰덊샇瑜??낅젰?댁＜?몄슂
                </div>

                {/* ?낅젰 ?꾨뱶 */}
                <div style={{
                    width: "100%",
                    maxWidth: "600px",
                    position: "relative",
                    marginBottom: "20px",
                    display: "flex",
                    justifyContent: "center",
                }}>
                    <div style={{
                        borderBottom: "2px solid #333",
                        paddingBottom: "12px",
                        position: "relative",
                        width: "100%",
                        textAlign: "center",
                    }}>
                        {phoneNumber.length === 0 ? (
                            <div style={{
                                position: "absolute",
                                top: "0",
                                left: "50%",
                                transform: "translateX(-50%)",
                                color: "#999",
                                fontSize: "1.4rem",
                                pointerEvents: "none",
                            }}>
                                ?꾪솕踰덊샇 ?낅젰
                            </div>
                        ) : null}
                        <div style={{
                            fontSize: "2rem",
                            fontWeight: "600",
                            color: "#000",
                            minHeight: "40px",
                            paddingTop: phoneNumber.length === 0 ? "0" : "0",
                            textAlign: "center",
                        }}>
                            {formatPhoneNumber(phoneNumber)}
                        </div>
                    </div>
                </div>

                {/* ?レ옄 ?ㅽ뙣???곸뿭 */}
                <div style={{
                    width: "100%",
                    maxWidth: "600px",
                    display: "flex",
                    gap: "16px",
                }}>
                    {/* ?쇱そ: ?レ옄 ?ㅽ뙣??*/}
                    <div style={{
                        flex: 1,
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "12px",
                    }}>
                        {/* 泥?踰덉㎏ 以? 7, 8, 9 */}
                        <button
                            onClick={() => handleNumberClick(7)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            7
                        </button>
                        <button
                            onClick={() => handleNumberClick(8)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            8
                        </button>
                        <button
                            onClick={() => handleNumberClick(9)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            9
                        </button>

                        {/* ??踰덉㎏ 以? 4, 5, 6 */}
                        <button
                            onClick={() => handleNumberClick(4)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            4
                        </button>
                        <button
                            onClick={() => handleNumberClick(5)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            5
                        </button>
                        <button
                            onClick={() => handleNumberClick(6)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            6
                        </button>

                        {/* ??踰덉㎏ 以? 1, 2, 3 */}
                        <button
                            onClick={() => handleNumberClick(1)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            1
                        </button>
                        <button
                            onClick={() => handleNumberClick(2)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            2
                        </button>
                        <button
                            onClick={() => handleNumberClick(3)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            3
                        </button>

                        {/* ??踰덉㎏ 以? 0, 010 */}
                        <button
                            onClick={() => handleNumberClick(0)}
                            style={{
                                height: "80px",
                                fontSize: "1.8rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            0
                        </button>
                        <button
                            onClick={handle010}
                            style={{
                                height: "80px",
                                fontSize: "1.2rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                gridColumn: "span 2",
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
                            010
                        </button>
                    </div>

                    {/* ?ㅻⅨ履? 吏? 諛??뺤씤 踰꾪듉 */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "120px",
                    }}>
                        <button
                            onClick={handleDelete}
                            style={{
                                width: "100%",
                                height: "80px",
                                fontSize: "1.2rem",
                                fontWeight: "700",
                                backgroundColor: "#ffffff",
                                color: "#000000",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                cursor: "pointer",
                                transition: "all 0.2s",
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
                            吏?
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={phoneNumber.length < 10}
                            style={{
                                width: "100%",
                                flex: 1,
                                fontSize: "1.5rem",
                                fontWeight: "700",
                                backgroundColor: "#ff0000",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                cursor: phoneNumber.length >= 10 ? "pointer" : "not-allowed",
                                transition: "all 0.2s",
                                opacity: phoneNumber.length >= 10 ? 1 : 0.6,
                            }}
                            onMouseEnter={(e) => {
                                if (phoneNumber.length >= 10) {
                                    e.currentTarget.style.backgroundColor = "#cc0000";
                                    e.currentTarget.style.opacity = "1";
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#ff0000";
                                e.currentTarget.style.opacity = phoneNumber.length >= 10 ? "1" : "0.6";
                            }}
                        >
                            ?뺤씤
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
    return entry === "qr" ? <KioskAspectFrame>{shell}</KioskAspectFrame> : shell;
}

export default function PhoneInputPage() {
    return (
        <Suspense fallback={<main style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />}>
            <PhoneInputPageContent />
        </Suspense>
    );
}
