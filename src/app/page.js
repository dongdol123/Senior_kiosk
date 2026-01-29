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
        backgroundColor: "#f9f9f9",
        padding: "20px",
        }}
      >
      {/* 메인 컨텐츠 영역 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          gap: "40px",
          backgroundColor: "#ffffff",
        }}
      >
        {/* 상단 문구 */}
        <div
          style={{
            width: "100%",
            maxWidth: "500px",
            textAlign: "center",
            padding: "0 20px",
        }}
      >
          <h1 style={{ 
            fontSize: "2.5rem", 
            fontWeight: "600", 
            color: "#333",
            lineHeight: "1.4",
            margin: 0,
          }}>
            키오스크와 <span style={{ color: "#ff0000", fontSize: "2.9rem", fontWeight: "700" }}>대화</span>하면서<br />
            편리하게 주문해보세요
          </h1>
        </div>

        {/* 가운데 이미지 영역 */}
        <div
          style={{
            width: "100%",
            maxWidth: "500px",
            height: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/main_char.png"
            alt="메인 캐릭터"
            style={{
              width: "100%",
              maxWidth: "500px",
              height: "auto",
              display: "block",
              objectFit: "contain",
          }}
          />
        </div>

        {/* 포장/매장 선택 버튼 */}
        <div
          style={{
            display: "flex",
            gap: 0,
            width: "100%",
            maxWidth: "800px",
            height: "200px",
            borderRadius: "16px",
            overflow: "hidden",
            border: "2px solid #000000",
          }}
        >
          {/* 여기서 먹기 버튼 (매장) - 왼쪽 */}
          <button
            onClick={() => handleOrderType("dinein")}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              position: "relative",
              padding: 0,
              height: "100%",
              width: "100%",
              backgroundColor: "#ffffff",
              border: "none",
              borderRight: "1px solid #000000",
              borderRadius: 0,
              cursor: "pointer",
              overflow: "hidden",
              transition: "transform 0.2s, box-shadow 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
          >
            <img
              src="/dinein-button.png"
              alt="여기서 먹기"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                objectPosition: "center",
                position: "absolute",
                top: 0,
                left: 0,
              }}
              onError={(e) => {
                // 이미지가 없을 경우 대체 텍스트 표시
                e.target.style.display = "none";
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          </button>

          {/* 집에 가져가기 버튼 (포장) - 오른쪽 */}
          <button
            onClick={() => handleOrderType("takeout")}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              position: "relative",
              padding: 0,
              height: "100%",
              width: "100%",
              backgroundColor: "#ffffff",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              overflow: "hidden",
              transition: "transform 0.2s, box-shadow 0.2s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
            }}
          >
            <img
              src="/takeout-button.png"
              alt="집에 가져가기"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                objectPosition: "center",
                position: "absolute",
                top: 0,
                left: 0,
              }}
              onError={(e) => {
                // 이미지가 없을 경우 대체 텍스트 표시
                e.target.style.display = "none";
                const fallback = e.target.nextSibling;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div style={{ color: "#b00020", padding: "16px", textAlign: "center" }}>{errorMessage}</div>
      ) : null}
    </main>
  );
}
