"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { speakKorean } from "../utils/speakKorean";

export default function PhoneInputPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [phoneNumber, setPhoneNumber] = useState("");
    const [total, setTotal] = useState(0);
    const [orderType, setOrderType] = useState("takeout");
    const [isListening, setIsListening] = useState(false);
    const [assistantMessage, setAssistantMessage] = useState("");
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

    function handleConfirm() {
        if (phoneNumber.length < 10) {
            alert("올바른 핸드폰 번호를 입력해주세요.");
            return;
        }
        
        // 포인트 적립 및 결제 처리 (추후 구현)
        const cartData = searchParams.get("cart");
        alert(`핸드폰 번호 ${formatPhoneNumber(phoneNumber)}로 포인트 적립 후 결제하기: ${total.toLocaleString()}원`);
    }

    function handleBack() {
        const cartData = searchParams.get("cart");
        router.push(`/points?cart=${cartData}&total=${total}&orderType=${orderType}`);
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
                    <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>핸드폰 번호 입력</h2>
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
                        {isListening ? "음성 인식 중" : "대화로 입력 가능"}
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
                        padding: "40px",
                        width: "100%",
                    }}
                >
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "bold", marginBottom: "20px", textAlign: "center" }}>
                        핸드폰 번호를 입력해주세요
                    </h3>
                    
                    <div style={{ marginBottom: "30px" }}>
                        <input
                            ref={inputRef}
                            type="tel"
                            value={formatPhoneNumber(phoneNumber)}
                            onChange={handlePhoneChange}
                            placeholder="010-1234-5678"
                            style={{
                                width: "100%",
                                padding: "20px",
                                fontSize: "1.5rem",
                                textAlign: "center",
                                border: "2px solid #ddd",
                                borderRadius: "12px",
                                outline: "none",
                            }}
                            onFocus={(e) => e.target.style.borderColor = "#1e7a39"}
                            onBlur={(e) => e.target.style.borderColor = "#ddd"}
                        />
                    </div>

                    <div style={{ textAlign: "center", color: "#777", marginBottom: "30px" }}>
                        포인트 적립 후 결제 금액: <strong style={{ color: "#1e7a39" }}>{total.toLocaleString()}원</strong>
                    </div>

                    <button
                        onClick={handleConfirm}
                        disabled={phoneNumber.length < 10}
                        style={{
                            width: "100%",
                            padding: "20px",
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            backgroundColor: phoneNumber.length >= 10 ? "#1e7a39" : "#ccc",
                            color: "#fff",
                            border: "none",
                            borderRadius: "12px",
                            cursor: phoneNumber.length >= 10 ? "pointer" : "not-allowed",
                            boxShadow: phoneNumber.length >= 10 ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                        }}
                    >
                        적립하고 결제하기
                    </button>
                </div>

                {/* 숫자 키패드 */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "12px",
                        width: "100%",
                        maxWidth: "400px",
                    }}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "삭제"].map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                if (item === "삭제") {
                                    setPhoneNumber(prev => prev.slice(0, -1));
                                } else if (item !== "") {
                                    if (phoneNumber.length < 11) {
                                        setPhoneNumber(prev => prev + String(item));
                                    }
                                }
                            }}
                            disabled={item === ""}
                            style={{
                                height: "70px",
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                backgroundColor: item === "" ? "transparent" : "#fff",
                                color: item === "삭제" ? "#b00020" : "#333",
                                border: item === "" ? "none" : "2px solid #ddd",
                                borderRadius: "12px",
                                cursor: item === "" ? "default" : "pointer",
                                boxShadow: item === "" ? "none" : "0 2px 6px rgba(0,0,0,0.1)",
                            }}
                        >
                            {item === "" ? "" : item}
                        </button>
                    ))}
                </div>
            </div>
        </main>
    );
}

