"use client";

/**
 * Letterboxed 9:16 frame so QR mobile matches kiosk proportions.
 */
export default function KioskAspectFrame({ children }) {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#141414",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    width: "min(100vw, calc(100vh * 9 / 16))",
                    height: "min(100vh, calc(100vw * 16 / 9))",
                    maxHeight: "100vh",
                    maxWidth: "100vw",
                    position: "relative",
                    overflow: "hidden",
                    backgroundColor: "#f9f9f9",
                    boxShadow: "0 12px 48px rgba(0, 0, 0, 0.35)",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {children}
            </div>
        </div>
    );
}
