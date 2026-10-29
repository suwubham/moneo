// Pages the model makes are untrusted. This head goes before the model's HTML, so the browser reads our
// Content-Security-Policy first: no network at all, only inline script and style. A later <meta> can only
// tighten it, and a <head> after ours is ignored. The downloaded copy keeps it too.
export const pageCsp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'";

// The app's colours and a few ready-made styles, so a page reads as part of the chat. The card sets data-theme
// on <html> to match, and adds the app's own fonts as "Moneo Sans", "Moneo Mono" and "Moneo Serif" (withTheme).
// MAKE_FILES in assistant/tools.ts teaches the model these names: change both together.
const tokens = `:root{color-scheme:dark;--night:#001b29;--night-2:#00263a;--night-3:#003049;--line:#2a4a5c;--ink:#fdf0d5;--ink-soft:#b3bcc0;--ash:#3f6178;--accent:#ef4a55;--steel:#669bbc;--frost:#a8cbe0;--amber:#e8c38a;--chart-in:#3987e5;--chart-out:#d95926;--cat-1:#3987e5;--cat-2:#d95926;--cat-3:#199e70;--cat-4:#c98500;--cat-5:#d55181;--cat-6:#2f9a2f;--cat-7:#9085e9;--cat-8:#e66767;--font-sans:"Moneo Sans","Helvetica Neue",Arial,system-ui,sans-serif;--font-mono:"Moneo Mono",ui-monospace,Menlo,monospace;--font-serif:"Moneo Serif",Georgia,serif}
:root[data-theme="light"]{color-scheme:light;--night:#fdf0d5;--night-2:#f7e4bf;--night-3:#f0d9ab;--line:#d6c7a6;--ink:#003049;--ink-soft:#3e5a6b;--ash:#9ba9ad;--accent:#c1121f;--steel:#2b6388;--frost:#003049;--amber:#780000;--chart-in:#2a78d6;--chart-out:#c4521f;--cat-1:#2a78d6;--cat-2:#c4521f;--cat-3:#12855c;--cat-4:#a66f00;--cat-5:#c2457a;--cat-6:#008300;--cat-7:#6250d6;--cat-8:#d03a3a}
*{box-sizing:border-box}
html,body{margin:0;background:var(--night);color:var(--ink);font:15px/1.5 var(--font-sans)}
/* The card grows to the page's height, so the page itself never scrolls (overflow on html only: on body it would make body a scroll box). */
html{overflow:hidden}
body{padding:16px}
h1,h2,h3,p{margin:0}
svg,canvas,img{display:block;max-width:100%;height:auto}
svg text{font-family:var(--font-mono);font-size:11px;fill:var(--ink-soft)}
.stack{display:grid;gap:12px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px}
.card{background:var(--night-2);border:1px solid var(--line);border-radius:18px 10px 18px 10px;padding:18px;min-width:0}
.label{font:12.5px/1.4 var(--font-mono);color:var(--ink-soft);letter-spacing:.01em}
.card>.label:first-child{margin-bottom:8px}
.title{font-size:22px;font-weight:800;letter-spacing:-.04em;line-height:1.1}
.title em{font-family:var(--font-serif);font-weight:400;color:var(--accent)}
.big{font-size:clamp(26px,7vw,40px);font-weight:800;letter-spacing:-.045em;line-height:1;font-variant-numeric:tabular-nums}
.soft{color:var(--ink-soft)}
.num{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:2px 10px;font:12px/1.6 var(--font-mono);color:var(--ink-soft)}
.up{color:var(--steel)}.down{color:var(--amber)}
.meter{height:6px;border-radius:999px;background:var(--night-3);overflow:hidden}.meter>i{display:block;height:100%;border-radius:inherit;background:var(--chart-out);transform-origin:0 50%}
table{width:100%;border-collapse:collapse;font-size:14px}th{font:12px var(--font-mono);color:var(--ink-soft);text-align:left;padding:6px 8px}td{padding:8px;border-top:1px solid var(--line)}
.bars{display:grid;gap:10px}.bars>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;align-items:baseline}.bars .meter{grid-column:1/-1}
@media (max-width:480px){body{padding:12px}table{font-size:13px}th,td{padding:6px 4px}.card{padding:14px}}
input[type=range]{width:100%;accent-color:var(--accent)}
button,input,select{font:inherit;color:inherit}
button{border:1px solid var(--line);background:var(--night-3);border-radius:999px;padding:6px 14px;cursor:pointer}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`;

// Tells the card in the chat how tall the page is, so it shows without an inner scrollbar.
const height = `<script>(function(){var s=function(){parent.postMessage({moneoHeight:document.documentElement.scrollHeight},"*")};addEventListener("load",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement)})()</script>`;

export const pageHead = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${pageCsp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${tokens}</style>${height}</head>`;

export function wrapHtml(html: string) {
  // Drop the model's own doctype; the rest of its document folds into ours as the parser goes.
  return pageHead + html.replace(/^\s*<!doctype[^>]*>/i, "");
}

// The chat renders a stored page with the viewer's theme, the app's fonts as data: URLs (the policy allows no
// other font source), no padding and no scrolling, since the frame grows to fit: older pages and any page that
// sets its own overflow get it too. All of it goes in just after our policy, which stays the first thing the browser reads.
export function withTheme(page: string, theme: "light" | "dark", fonts = "") {
  const start = "<!doctype html><html><head>";
  const policy = `content="${pageCsp}">`;
  const at = page.indexOf(policy);
  if (!page.startsWith(start) || at < 0) return page;
  const end = at + policy.length;
  // In the chat the page sits flush with the text; the downloaded copy keeps its padding.
  const style = `<style>html{overflow:hidden!important}body{padding:0!important}${fonts}</style>`;
  return `<!doctype html><html data-theme="${theme}"><head>${page.slice(start.length, end)}${style}${page.slice(end)}`;
}
