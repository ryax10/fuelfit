import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FuelFit — Suplementos y Ropa Deportiva";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#080810",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gradient glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 800,
            height: 400,
            background:
              "radial-gradient(ellipse at center, rgba(139,92,246,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent, #8b5cf6, #a855f7, #8b5cf6, transparent)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            zIndex: 1,
          }}
        >
          {/* Brand name */}
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-2px",
              lineHeight: 1,
              display: "flex",
            }}
          >
            FUELFIT
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#a855f7",
              letterSpacing: "12px",
              marginTop: 12,
              display: "flex",
            }}
          >
            FITNESS STORE
          </div>

          {/* Divider */}
          <div
            style={{
              width: 120,
              height: 2,
              background: "linear-gradient(90deg, transparent, #8b5cf6, transparent)",
              marginTop: 36,
              display: "flex",
            }}
          />

          {/* Description */}
          <div
            style={{
              fontSize: 24,
              color: "#a1a1aa",
              marginTop: 28,
              textAlign: "center",
              maxWidth: 700,
              lineHeight: 1.5,
              display: "flex",
            }}
          >
            Suplementos deportivos y ropa fitness · Mayorista y minorista
          </div>

          {/* Tags */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 36,
            }}
          >
            {["Suplementos premium", "Envíos a todo el país", "Argentina"].map(
              (tag) => (
                <div
                  key={tag}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 999,
                    border: "1px solid rgba(139,92,246,0.3)",
                    background: "rgba(139,92,246,0.08)",
                    color: "#c4b5fd",
                    fontSize: 18,
                    display: "flex",
                  }}
                >
                  {tag}
                </div>
              )
            )}
          </div>
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            color: "#52525b",
            fontSize: 18,
            letterSpacing: "2px",
            display: "flex",
          }}
        >
          www.fuelfit.com.ar
        </div>
      </div>
    ),
    { ...size }
  );
}
