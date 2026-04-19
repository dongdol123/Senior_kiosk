"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

const QR_MODAL_MS = 10_000;

/**
 * URL encoded in the QR. Scan opens this address (usually menu flow).
 * Deploy: NEXT_PUBLIC_QR_ORDER_URL=https://example.com/qr-order
 */
function getDefaultQrOrderUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_QR_ORDER_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  if (typeof window !== "undefined") {
    return `${window.location.origin}/qr-order`;
  }
  return "https://example.com/qr-order";
}

function QrMarkIcon({ color = "#6b7280" }) {
  const stroke = color;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        display: "block",
        flexShrink: 0,
        width: "min(88px, 14vmin)",
        height: "min(88px, 14vmin)",
      }}
    >
      <rect width="5" height="5" x="3" y="3" rx="1" />
      <rect width="5" height="5" x="16" y="3" rx="1" />
      <rect width="5" height="5" x="3" y="16" rx="1" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h1" />
      <path d="M21 12v.01" />
      <path d="M12 21v-4" />
    </svg>
  );
}

const kioskIconBox = {
  display: "block",
  flexShrink: 0,
  width: "min(88px, 14vmin)",
  height: "min(88px, 14vmin)",
};

const neonYellow = {
  fontWeight: 400,
  color: "#faff8f",
};

function DineInWhiteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      stroke="#ffffff"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={kioskIconBox}
    >
      <path
        strokeWidth="1.5"
        d="M 8 18.75 L 8 11.15 C 6.45 10.95 5.35 9.35 5.35 7.55 C 5.35 5.55 6.55 4.35 8 4.35 C 9.45 4.35 10.65 5.55 10.65 7.55 C 10.65 9.35 9.55 10.95 8 11.15 L 8 18.75"
      />
      <path
        strokeWidth="1.25"
        d="M 13.85 4.35 V 10.88 M 16 4.35 V 10.88 M 18.15 4.35 V 10.88"
      />
      <path strokeWidth="1.45" d="M 13.45 11.05 H 18.55" />
      <path strokeWidth="1.5" d="M 16 11.15 V 18.75" />
    </svg>
  );
}

function TakeoutWhiteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={kioskIconBox}
    >
      <path d="M7 10h10l-1.2 10H8.2L7 10z" />
      <path d="M9.5 10V8.5a2.5 2.5 0 0 1 5 0V10" />
      <path d="M15.5 6.5h6" />
      <path d="M19 4.5l2.5 2-2.5 2" />
    </svg>
  );
}

export default function HomePage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window !== "undefined") {
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
            console.log("음성인식 정리 중 오류:", e);
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
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const openQrModal = useCallback(() => {
    setQrUrl(getDefaultQrOrderUrl());
    setQrOpen(true);
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    const id = window.setTimeout(() => setQrOpen(false), QR_MODAL_MS);
    return () => window.clearTimeout(id);
  }, [qrOpen]);

  function goKioskVoice(orderType) {
    router.push(`/menu?entry=voice&orderType=${orderType}`);
  }

  const blue = "#2563eb";
  const blueDark = "#1d4ed8";
  const squareSize = "min(27vmin, 188px)";

  const squareBase = {
    width: squareSize,
    height: squareSize,
    aspectRatio: "1",
    flexShrink: 0,
    border: "none",
    borderRadius: "24px",
    cursor: "pointer",
    fontSize: "clamp(1.42rem, 3.65vw, 2.2rem)",
    fontWeight: 700,
    fontFamily:
      'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif',
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    lineHeight: 1.25,
    padding: "10px",
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
        backgroundColor: "#f1f5f9",
      }}
    >
      <section
        style={{
          flex: "7 1 0",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 16px 8px",
          backgroundColor: blue,
          gap: "clamp(6px, 1.2vh, 14px)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "960px",
            display: "flex",
            flexDirection: "column",
            gap: "0.42em",
            letterSpacing: "0.01em",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: "clamp(1.82rem, 4.65vw, 3.15rem)",
              fontWeight: 400,
              color: "#ffffff",
              lineHeight: 1.5,
              textShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
            AI{" "}
            <span
              style={{
                ...neonYellow,
                fontSize: "clamp(2.05rem, 5.35vw, 3.65rem)",
              }}
            >
              대화형
            </span>{" "}
            키오스크에서
          </div>
          <div
            style={{
              fontSize: "clamp(1.82rem, 4.65vw, 3.15rem)",
              fontWeight: 400,
              color: "#ffffff",
              lineHeight: 1.5,
              textShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }}
          >
            <span
              style={{
                ...neonYellow,
                fontSize: "clamp(2.05rem, 5.35vw, 3.65rem)",
                textDecoration: "underline",
                textDecorationColor: "#fffde7",
                textDecorationThickness: "0.11em",
                textUnderlineOffset: "0.05em",
                textDecorationSkipInk: "none",
              }}
            >
              대화하면서
            </span>{" "}
            편하게 주문해보세요!
          </div>
        </div>
        <div
          style={{
            position: "relative",
            flex: "1 1 auto",
            minHeight: 0,
            width: "100%",
            maxWidth: "min(100%, 980px)",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: blue,
          }}
        >
          <img
            src="/yeondu-home-poster.png"
            alt="연두햄버거"
            style={{
              display: "block",
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              boxShadow: `inset 0 0 50px 28px ${blue}`,
            }}
          />
        </div>
      </section>

      <section
        style={{
          flex: "3 1 0",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "clamp(10px, 2.5vw, 22px)",
          padding: "10px 16px 14px",
          backgroundColor: "#ffffff",
        }}
      >
        <button
          type="button"
          onClick={openQrModal}
          style={{
            ...squareBase,
            flexDirection: "column",
            gap: "8px",
            padding: "14px 8px",
            backgroundColor: "#ffffff",
            color: blueDark,
            border: `3px solid ${blue}`,
            boxShadow: "0 8px 24px rgba(37, 99, 235, 0.12)",
            fontSize: "clamp(1.05rem, 2.85vw, 1.65rem)",
            whiteSpace: "nowrap",
            cursor: "pointer",
          }}
        >
          <QrMarkIcon color="#6b7280" />
          QR로 주문하기
        </button>

        <button
          type="button"
          onClick={() => goKioskVoice("dinein")}
          style={{
            ...squareBase,
            flexDirection: "column",
            gap: "8px",
            padding: "14px 10px",
            backgroundColor: blue,
            color: "#ffffff",
            boxShadow: "0 10px 28px rgba(37, 99, 235, 0.35)",
          }}
        >
          <DineInWhiteIcon />
          먹고가기
        </button>

        <button
          type="button"
          onClick={() => goKioskVoice("takeout")}
          style={{
            ...squareBase,
            flexDirection: "column",
            gap: "8px",
            padding: "14px 10px",
            backgroundColor: blue,
            color: "#ffffff",
            boxShadow: "0 10px 28px rgba(37, 99, 235, 0.35)",
          }}
        >
          <TakeoutWhiteIcon />
          포장하기
        </button>
      </section>

      {qrOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QR 주문"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onClick={() => setQrOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              padding: "clamp(20px, 4vw, 32px)",
              maxWidth: "92vw",
              boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
              textAlign: "center",
              fontFamily:
                'system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "clamp(1.1rem, 3vw, 1.45rem)",
                fontWeight: 700,
                color: "#1e293b",
              }}
            >
              QR로 주문하기
            </p>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: "0.95rem",
                color: "#64748b",
              }}
            >
            휴대폰 카메라로 비추세요. ({QR_MODAL_MS / 1000}초 후 자동으로 닫힙니다)

            </p>
            <div
              style={{
                display: "inline-block",
                padding: "12px",
                backgroundColor: "#ffffff",
                borderRadius: "12px",
              }}
            >
              {qrUrl ? (
                <QRCode
                  value={qrUrl}
                  size={256}
                  level="M"
                  fgColor="#0f172a"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
