import { ImageResponse } from "next/og";

// Image output has no CSS variables, so the palette's night and ink are spelled out here.
const night = "#001b29";
const ink = "#fdf0d5";
const accent = "#ef4a55";

export function generateImageMetadata() {
  return [192, 512].map((n) => ({ id: String(n), size: { width: n, height: n }, contentType: "image/png" }));
}

// Kept inside the middle 80% so phones that crop icons to a circle (maskable) never cut the mark.
export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: night }}>
        <div style={{ display: "flex", alignItems: "baseline", color: ink, fontSize: size * 0.56, fontWeight: 800, letterSpacing: "-0.06em", marginTop: -size * 0.08 }}>
          m<span style={{ color: accent }}>.</span>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
