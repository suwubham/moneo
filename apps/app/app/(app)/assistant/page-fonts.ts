// The app's fonts for the pages the assistant makes. Those pages may load nothing from the network, so the
// files this page already downloaded (next/font, see app/fonts.ts) go in as data: URLs, renamed to the names
// lib/modules/files/html.ts gives them. Built once per visit; a failure only means the fallback fonts.
const FAMILIES = [
  ["--font-bricolage", "Moneo Sans"],
  ["--font-jetbrains", "Moneo Mono"],
  ["--font-fraunces", "Moneo Serif"],
] as const;

let built: Promise<string> | null = null;

export function pageFonts() {
  built ??= build().catch(() => "");
  return built;
}

function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");

async function build() {
  const faces: CSSFontFaceRule[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) if (rule instanceof CSSFontFaceRule) faces.push(rule);
    } catch {
      // A sheet from another origin can't be read; ours are same-origin.
    }
  }
  const root = getComputedStyle(document.documentElement);
  const out: Promise<string>[] = [];
  for (const [variable, name] of FAMILIES) {
    const family = unquote(root.getPropertyValue(variable).split(",")[0] ?? "");
    for (const face of faces) {
      if (!family || unquote(face.style.getPropertyValue("font-family")) !== family) continue;
      const src = face.style.getPropertyValue("src").match(/url\(\s*["']?([^"')]+)/)?.[1];
      // Only the Latin files: the others are other scripts (Vietnamese, Cyrillic) a chart about money rarely needs.
      const range = face.style.getPropertyValue("unicode-range");
      if (!src || (range && !/U\+0+-0*FF\b/i.test(range))) continue;
      // The URL is relative to its stylesheet (../media/…), not to this page.
      const url = new URL(src, face.parentStyleSheet?.href ?? location.href).href;
      const weight = face.style.getPropertyValue("font-weight") || "normal";
      const style = face.style.getPropertyValue("font-style") || "normal";
      out.push(
        fetch(url)
          .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
          .then(dataUrl)
          .then((src) => `@font-face{font-family:"${name}";src:url(${src}) format("woff2");font-weight:${weight};font-style:${style};font-display:block;${range ? `unicode-range:${range};` : ""}}`),
      );
    }
  }
  // One missing file only costs that face its fallback.
  return (await Promise.allSettled(out)).map((r) => (r.status === "fulfilled" ? r.value : "")).join("");
}
