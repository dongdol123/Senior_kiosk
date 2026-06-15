"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [activeOrderType, setActiveOrderType] = useState("");
  const [showQuickRecommendChoice, setShowQuickRecommendChoice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // 새 주문 시작: 1회 안내 플래그 리셋
        window.sessionStorage.removeItem("menuGreetingPlayed");
      } catch (e) {
        console.log("sessionStorage 정리 중 오류:", e);
      }
      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition && window.currentRecognition) {
          try {
            window.currentRecognition.stop();
            window.currentRecognition.onresult = null;
            window.currentRecognition.onend = null;
            window.currentRecognition.onerror = null;
            window.currentRecognition.onstart = null;
          } catch (e) {
            console.log("음성 인식 정리 중 오류:", e);
          }
          window.currentRecognition = null;
        }
      } catch (e) {
        console.log("SpeechRecognition 정리 중 오류:", e);
      }
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        console.log("SpeechSynthesis 정리 중 오류:", e);
      }
    }
  }, []);

  function goKioskVoice(orderType) {
    setActiveOrderType(orderType);
    router.push(`/menu?entry=voice&orderType=${orderType}`);
  }

  function goQuickRecommendation(orderType) {
    setActiveOrderType(orderType);
    setShowQuickRecommendChoice(false);
    router.push(`/menu?quickRecommend=1&entry=voice&orderType=${orderType}`);
  }

  const blue = "#002e55";
  const accent = "#fec315";
  const mainFontFamily =
    '"NanumSquareNeoExtraBold", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  const squareSize = "min(45vw, 310px)";

  const squareBase = {
    width: squareSize,
    height: "min(59vw, 410px)",
    flexShrink: 0,
    border: "none",
    borderRadius: "24px",
    cursor: "pointer",
    fontSize: "clamp(1.95rem, 4.9vw, 2.9rem)",
    fontWeight: 700,
    fontFamily: mainFontFamily,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    textAlign: "center",
    lineHeight: 1.25,
    padding: "60px 22px 20px",
    gap: "22px",
  };

  return (
    <main
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        padding: 0,
        margin: 0,
        backgroundColor: "#002e55",
      }}
    >
      <section
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "72px 16px 18px",
          backgroundColor: blue,
          gap: "34px",
        }}
      >
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: blue,
          }}
        >
          <img
            src="/main_logo.png"
            alt="main logo"
            style={{
              display: "block",
              width: "min(100%, 320px)",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "194px",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: "680px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "30px",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: "clamp(1.9rem, 5vw, 3rem)",
              fontWeight: 700,
              fontFamily: mainFontFamily,
              textAlign: "center",
              lineHeight: 1.15,
              padding: "18px 0",
            }}
          >
            식사 방법을 선택해주세요
          </div>
          <div
            style={{
              width: "100%",
              maxWidth: "680px",
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
              gap: "58px",
            }}
          >
            <button
              type="button"
              onClick={() => goKioskVoice("dinein")}
              style={{
                ...squareBase,
                backgroundColor: activeOrderType === "dinein" ? "#c8d8ea" : "#ffffff",
                color: blue,
                boxShadow: "none"
              }}
            >
              <img
                src="/main_in.png"
                alt=""
                aria-hidden="true"
                style={{
                  width: "96%",
                  maxWidth: "242px",
                  height: "auto",
                  objectFit: "contain",
                  marginTop: "12px",
                }}
              />
              <span style={{ marginTop: "5px", display: "block" }}>여기서 먹기</span>
            </button>

            <button
              type="button"
              onClick={() => goKioskVoice("takeout")}
              style={{
                ...squareBase,
                backgroundColor: activeOrderType === "takeout" ? "#c8d8ea" : "#ffffff",
                color: blue,
                boxShadow: "none"
              }}
            >
              <img
                src="/main_out.png"
                alt=""
                aria-hidden="true"
                style={{
                  width: "82%",
                  maxWidth: "190px",
                  height: "auto",
                  objectFit: "contain",
                  marginTop: "12px",
                }}
              />
              <span>포장하기</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickRecommendChoice(true)}
            style={{
              width: "100%",
              minHeight: "92px",
              marginTop: "10px",
              border: "3px solid #fec315",
              borderRadius: "24px",
              backgroundColor: "#ffffff",
              color: blue,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px",
              padding: "22px 28px",
              fontFamily: mainFontFamily,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "clamp(1.25rem, 3.5vw, 2rem)", fontWeight: 800 }}>
                고르기 쉬운 빠른 추천
              </span>
              <span style={{ fontSize: "clamp(0.95rem, 2vw, 1.2rem)", fontWeight: 600, color: "#33597b" }}>
                자주 고르는 메뉴를 먼저 보여드릴게요
              </span>
            </div>
            <span
              aria-hidden="true"
              style={{
                fontSize: "clamp(1.9rem, 4vw, 2.5rem)",
                fontWeight: 800,
                color: accent,
                lineHeight: 1,
              }}
            >
              ›
            </span>
          </button>
        </div>
      </section>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-220px",
          transform: "translateX(-50%)",
          width: "150vw",
          height: "360px",
          backgroundColor: accent,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {showQuickRecommendChoice && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 10,
          }}
          onClick={() => setShowQuickRecommendChoice(false)}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              backgroundColor: "#ffffff",
              borderRadius: "28px",
              padding: "34px 30px 30px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.22)",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: mainFontFamily,
                color: blue,
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              빠른 추천 전에
              <br />
              식사 방법을 선택해주세요
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "24px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => goQuickRecommendation("dinein")}
                style={{
                  width: "min(280px, 100%)",
                  minHeight: "92px",
                  border: "none",
                  borderRadius: "22px",
                  backgroundColor: "#002e55",
                  color: "#ffffff",
                  fontFamily: mainFontFamily,
                  fontSize: "clamp(1.3rem, 3vw, 1.9rem)",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                여기서 먹기
              </button>
              <button
                type="button"
                onClick={() => goQuickRecommendation("takeout")}
                style={{
                  width: "min(280px, 100%)",
                  minHeight: "92px",
                  border: "3px solid #002e55",
                  borderRadius: "22px",
                  backgroundColor: "#ffffff",
                  color: "#002e55",
                  fontFamily: mainFontFamily,
                  fontSize: "clamp(1.3rem, 3vw, 1.9rem)",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                포장하기
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickRecommendChoice(false)}
              style={{
                alignSelf: "center",
                border: "none",
                background: "transparent",
                color: "#5f7690",
                fontFamily: mainFontFamily,
                fontSize: "1.05rem",
                fontWeight: 700,
                cursor: "pointer",
                padding: "6px 10px",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
      <style jsx global>{`
        @font-face {
          font-family: "NanumSquareNeoExtraBold";
          src: url("/NanumSquareNeo-eHv.ttf") format("truetype");
          font-weight: 400 700;
          font-style: normal;
        }
      `}</style>
    </main>
  );
}
