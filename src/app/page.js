"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const mountedRef = useRef(true);

  // 첫 페이지가 마운트될 때 음성인식 초기화
  useEffect(() => {
    mountedRef.current = true;
    
    // 실행 중인 모든 음성인식 정리
    if (typeof window !== "undefined") {
      // SpeechRecognition 정리
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          // 전역 recognition 인스턴스가 있다면 정리
          if (window.currentRecognition) {
            try {
              window.currentRecognition.stop();
              window.currentRecognition.onresult = null;
              window.currentRecognition.onend = null;
              window.currentRecognition.onerror = null;
              window.currentRecognition.onstart = null;
            } catch (e) {
              console.log("음성인식 정리 중 오류:", e);
            }
            window.currentRecognition = null;
          }
        }
      } catch (e) {
        console.log("SpeechRecognition 정리 중 오류:", e);
      }

      // SpeechSynthesis 정리
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        console.log("SpeechSynthesis 정리 중 오류:", e);
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleOrderType(type) {
    // 포장 또는 매장 선택 시 바로 음성 주문 시작
    router.push(`/menu?entry=voice&orderType=${type}`);
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        padding: 0,
        margin: 0,
      }}
    >
      {/* 상단 캐릭터 및 인사말 영역 */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          padding: "5px 60px",
          backgroundColor: "#ffffff",
          position: "relative",
        }}
      >
        {/* 왼쪽 텍스트 영역 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: 1,
            paddingBottom: "40px",
          }}
        >
          <div style={{
            fontSize: "2.4rem",
            fontWeight: "600",
            color: "#000000",
            lineHeight: "1.4",
          }}>
            안녕하세요!
          </div>
          <div style={{
            fontSize: "2.4rem",
            fontWeight: "600",
            lineHeight: "1.4",
          }}>
            <span style={{ color: "#1e7a39" }}>연두</span>
            <span style={{ color: "#000000" }}>햄버거입니다.</span>
          </div>
        </div>

        {/* 오른쪽 캐릭터 이미지 */}
        <div
          style={{
            width: "300px",
            height: "300px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src="/c1.png"
            alt="연두햄버거 캐릭터"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      </div>

      {/* 회색 가로선 */}
      <div
        style={{
          width: "100%",
          height: "1px",
          backgroundColor: "#cccccc",
          margin: "0",
        }}
      />

      {/* 중앙 안내 문구 */}
      <div
        style={{
          width: "100%",
          textAlign: "center",
          padding: "60px 20px",
          backgroundColor: "#ffffff",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{
          fontSize: "2.8rem",
          fontWeight: "700",
          color: "#000000",
          lineHeight: "1.4",
          maxWidth: "724px",
          width: "100%",
        }}>
          원하시는 항목을 선택해주세요
        </div>
      </div>

      {/* 하단 버튼 영역 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: "24px",
          padding: "0px 80px 60px 80px",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#ffffff",
        }}
      >
        {/* 여기서 먹기 버튼 */}
        <button
          onClick={() => handleOrderType("dinein")}
          style={{
            width: "350px",
            height: "450px",
            backgroundColor: "#1e7a39",
            color: "#ffffff",
            border: "none",
            borderRadius: "16px",
            cursor: "pointer",
            fontSize: "2.5rem",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          }}
        >
          여기서 먹기
        </button>

        {/* 포장하기 버튼 */}
        <button
          onClick={() => handleOrderType("takeout")}
          style={{
            width: "350px",
            height: "450px",
            backgroundColor: "#1e7a39",
            color: "#ffffff",
            border: "none",
            borderRadius: "16px",
            cursor: "pointer",
            fontSize: "2.5rem",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          }}
        >
          포장하기
        </button>
      </div>

      {errorMessage ? (
        <div style={{ color: "#b00020", padding: "16px", textAlign: "center" }}>{errorMessage}</div>
      ) : null}
    </main>
  );
}
