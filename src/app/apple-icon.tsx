import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS / Safari home-screen icon — matches `icon.svg` branding at touch size.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #3d4f6f, #283548)",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 0,
            height: 108,
            width: 124,
            position: "relative",
          }}
        >
          {/* book pages */}
          <div
            style={{
              width: 52,
              height: "100%",
              background: "#f5f2ea",
              borderRadius: "6px 0 0 6px",
            }}
          />
          <div
            style={{
              width: 52,
              height: "100%",
              background: "#f5f2ea",
              borderRadius: "0 6px 6px 0",
            }}
          />
          {/* spine */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              width: 5,
              height: "100%",
              marginLeft: -2,
              background: "#c9a85a",
              borderRadius: 2,
            }}
          />
          {/* lens */}
          <div
            style={{
              position: "absolute",
              right: -6,
              top: 18,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "4px solid #e8d9b8",
              background: "transparent",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -22,
              top: 54,
              width: 28,
              height: 5,
              background: "#e8d9b8",
              borderRadius: 3,
              transform: "rotate(45deg)",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
