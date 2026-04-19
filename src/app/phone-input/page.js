"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";
import KioskAspectFrame from "../../components/KioskAspectFrame";
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
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const mountedRef = useRef(true);
    const firstStartRef = useRef(true);

    // 숫자 텍스트를 숫자로 변환 (예: "일공일" -> "010", "공일공" -> "010")
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
        
        // 한글 숫자 패턴 찾기
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

    // 음성 인식으로 숫자 추출
    function extractNumbersFromSpeech(text) {
        // 숫자만 추출
        let numbers = text.replace(/[^0-9일이삼사오육칠팔구공영]/g, "");
        
        // 한글 숫자가 있으면 변환
        if (/[일이삼사오육칠팔구공영]/.test(text)) {
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
        
        // 포커스
        if (inputRef.current) {
            inputRef.current.focus();
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
                const greeting = "핸드폰 번호를 눌러주세요";
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
            
            // 음성 인식 로그 추가
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
            
            // 숫자 추출
            const extractedNumbers = extractNumbersFromSpeech(transcript);
            
            if (extractedNumbers.length > 0) {
                // 현재 번호에 추가 (최대 11자리)
                setPhoneNumber(prev => {
                    const newNumber = prev + extractedNumbers;
                    return newNumber.slice(0, 11);
                });
                
                const msg = `${extractedNumbers} 입력했습니다.`;
                setAssistantMessage(msg);
                await speakKorean(msg);
            } else {
                // "확인", "완료" 등의 명령 처리
                const normalized = transcript.toLowerCase().replace(/\s/g, "");
                if (/확인|완료|결제|적립/.test(normalized)) {
                    if (phoneNumber.length >= 10) {
                        const msg = "적립하고 결제하시겠어요?";
                        setAssistantMessage(msg);
                        await speakKorean(msg);
                        setTimeout(() => {
                            handleConfirm();
                        }, 1500);
                    } else {
                        const msg = "핸드폰 번호를 모두 입력해주세요.";
                        setAssistantMessage(msg);
                        await speakKorean(msg);
                    }
                } else {
                    const msg = "번호를 말씀해주세요.";
                    setAssistantMessage(msg);
                    await speakKorean(msg);
                }
            }
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
    }, [phoneNumber]);

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
        if (phoneNumber.length < 10) {
            alert("올바른 핸드폰 번호를 입력해주세요.");
            return;
        }

        // 결제 페이지로 이동
        const cartData = searchParams.get("cart");
        router.push(`/payment?cart=${cartData}&total=${total}&orderType=${orderType}&phone=${phoneNumber}&${entryQuery(entry)}`);
    }

    function handleBack() {
        const cartData = searchParams.get("cart");
        router.push(`/points?cart=${cartData}&total=${total}&orderType=${orderType}&${entryQuery(entry)}`);
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
                {/* 왼쪽: 처음으로 버튼 */}
                <button
                    onClick={() => {
                        try { recognitionRef.current && recognitionRef.current.stop(); } catch { }
                        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch { }
                        router.push(entry === "qr" ? "/qr-order" : "/");
                    }}
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
                    처음으로
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
                <div style={{ width: "100px" }}></div>
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
                    
                    {/* 진행된 부분의 가로선 (1단계에서 2단계까지) */}
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "15%",
                        width: "calc(30% - 15%)",
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
                            backgroundColor: "#000000",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "16px",
                            fontWeight: "700",
                        }}>
                            2
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#000" }}>포인트 적립</div>
                    </div>

                    {/* 3 결제하기 */}
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
                            3
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: "600", color: "#666" }}>결제하기</div>
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
                    포인트 적립을 위해 전화번호를 입력해주세요
                </div>

                {/* 입력 필드 */}
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
                                전화번호 입력
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

                {/* 숫자 키패드 영역 */}
                <div style={{
                    width: "100%",
                    maxWidth: "600px",
                    display: "flex",
                    gap: "16px",
                }}>
                    {/* 왼쪽: 숫자 키패드 */}
                    <div style={{
                        flex: 1,
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "12px",
                    }}>
                        {/* 첫 번째 줄: 7, 8, 9 */}
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

                        {/* 두 번째 줄: 4, 5, 6 */}
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

                        {/* 세 번째 줄: 1, 2, 3 */}
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

                        {/* 네 번째 줄: 0, 010 */}
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

                    {/* 오른쪽: 지움 및 확인 버튼 */}
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
                            지움
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
                            확인
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
