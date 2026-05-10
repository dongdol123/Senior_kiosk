"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [activeOrderType, setActiveOrderType] = useState("");

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
            maxWidth: "520px",
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
        </div>
      </section>
      <img
        src="/main_hamburger.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "12px",
          transform: "translateX(-50%)",
          width: "min(78vw, 360px)",
          height: "auto",
          objectFit: "contain",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-145px",
          transform: "translateX(-50%)",
          width: "150vw",
          height: "360px",
          backgroundColor: accent,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
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
