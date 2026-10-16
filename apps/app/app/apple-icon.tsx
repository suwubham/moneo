import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#001b29" }}>
        <div style={{ display: "flex", alignItems: "baseline", color: "#fdf0d5", fontSize: 100, fontWeight: 800, letterSpacing: "-0.06em", marginTop: -14 }}>
          m<span style={{ color: "#ef4a55" }}>.</span>
        </div>
      </div>
    ),
    size,
  );
}
