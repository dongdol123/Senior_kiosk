"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isListening, setIsListening] = useState(false);
  const [assistantReply, setAssistantReply] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [conversation, setConversation] = useState([]);
  const recognitionRef = useRef(null);
  const mountedRef = useRef(true);
  const shouldListenRef = useRef(true);
  const initTriedRef = useRef(false);

  function initRecognition() {
    const SpeechRecognition =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) return null;
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      setErrorMessage("");
      await handleUserTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setErrorMessage(`음성 인식 오류: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    initTriedRef.current = true;
    return recognition;
  }

  useEffect(() => {
    mountedRef.current = true;
    shouldListenRef.current = true;
    const SpeechRecognition =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = "ko-KR";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setErrorMessage("");
        await handleUserTranscript(transcript);
      };

      recognition.onerror = (event) => {
        setErrorMessage(`음성 인식 오류: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setErrorMessage("이 브라우저는 음성 인식을 지원하지 않습니다. 크롬을 권장합니다.");
    }
    const handleVisibility = () => {
      if (document.hidden) {
        shouldListenRef.current = false;
        try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { }
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
      } else {
        // 모바일 페이지가 다시 보일 때 오류 처린데 아직 해결안됨
        shouldListenRef.current = true;
        if (!recognitionRef.current) {
          initRecognition();
        }
      }
    };
    const handlePageHide = () => {
      shouldListenRef.current = false;
      try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { }
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      mountedRef.current = false;
      shouldListenRef.current = false;
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onstart = null;
          recognitionRef.current.stop();
        }
      } catch (e) { }
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

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

    }
  }

  async function handleOrderStart() {
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
    await speakKorean("무엇을 주문하시겠어요?");
    router.push("/menu?entry=voice");
  }

  async function handleUserTranscript(transcript) {
    const newConversation = [
      ...conversation,
      { role: "user", content: transcript },
    ];
    setConversation(newConversation);

    try {
      const res = await fetch("/api/voice-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newConversation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "API 오류");

      const reply = data?.reply || "죄송해요, 다시 말씀해 주시겠어요?";
      setAssistantReply(reply);
      setConversation((prev) => [...prev, { role: "assistant", content: reply }]);
      await speakKorean(reply);
    } catch (e) {
      setErrorMessage(e.message || "네트워크 오류가 발생했습니다.");
    }
  }

  function toggleListening() {
    router.push("/menu?entry=simple");
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#f9f9f9",
        padding: "20px",
      }}
    >
      {/* 환영 문구 */}
      <h1 style={{ fontSize: "2.5rem", marginBottom: "10px", fontWeight: "bold" }}>
        어서오세요
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "30px" }}>
        주문하시려면 아래 시작하기 버튼을 눌러주세요
      </p>

      {/* 시작하기 버튼 */}
      <button
        style={{
          fontSize: "1.5rem",
          backgroundColor: "#ffffff",
          border: "2px solid #ddd",
          padding: "20px 60px",
          borderRadius: "10px",
          cursor: "pointer",
          marginBottom: "50px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        }}
        onClick={toggleListening}
      >
        시작하기
      </button>

      {/* 구분선 */}
      <div
        style={{
          width: "80%",
          borderTop: "2px dashed #222822ff",
          marginBottom: "20px",
        }}
      ></div>

      {/* 간편 모드 섹션 */}
      <p style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "15px" }}>
        혹시 이용이 어려우신가요?
      </p>

      <button
        style={{
          fontSize: "1.5rem",
          backgroundColor: "#333",
          color: "white",
          padding: "15px 40px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          marginBottom: "10px",
        }}
        onClick={handleOrderStart}
      >
        대화로 주문하기
      </button>

      {assistantReply ? (
        <div style={{
          marginTop: "10px",
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: "8px",
          padding: "12px 16px",
          maxWidth: "480px",
          lineHeight: 1.5,
        }}>
          <strong>도우미</strong>: {assistantReply}
        </div>
      ) : null}

      {errorMessage ? (
        <div style={{ color: "#b00020", marginTop: "8px" }}>{errorMessage}</div>
      ) : null}

      <p style={{ fontSize: "1rem", color: "#555", maxWidth: "300px", textAlign: "center" }}>
        간편 모드를 먼저 이용해 보세요! <br />
        포인트 적립, 광고, 어려운 추가 메뉴 등을 생략하고 쉽게 주문할 수 있어요.
      </p>
    </main>
  );
}
