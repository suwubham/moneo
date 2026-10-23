// Pages the model makes are untrusted. This head goes before the model's HTML, so the browser reads our
// Content-Security-Policy first: no network at all, only inline script and style. A later <meta> can only
// tighten it, and a <head> after ours is ignored. The downloaded copy keeps it too.
export const pageCsp =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'";

// The app's colours, so a chart matches the screen. The card sets data-theme on <html> to match.
const tokens = `:root{color-scheme:dark;--night:#001b29;--night-2:#00263a;--night-3:#003049;--line:#2a4a5c;--ink:#fdf0d5;--ink-soft:#b3bcc0;--ash:#3f6178;--accent:#ef4a55;--steel:#669bbc;--frost:#a8cbe0}
:root[data-theme="light"]{color-scheme:light;--night:#fdf0d5;--night-2:#f7e4bf;--night-3:#f0d9ab;--line:#d6c7a6;--ink:#003049;--ink-soft:#3e5a6b;--ash:#9ba9ad;--accent:#c1121f;--steel:#2b6388;--frost:#003049}
html,body{margin:0;background:var(--night);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}`;

// Tells the card in the chat how tall the page is, so it shows without an inner scrollbar.
const height = `<script>(function(){var s=function(){parent.postMessage({moneoHeight:document.documentElement.scrollHeight},"*")};addEventListener("load",s);if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement)})()</script>`;

export const pageHead = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${pageCsp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${tokens}</style>${height}</head>`;

export function wrapHtml(html: string) {
  // Drop the model's own doctype; the rest of its document folds into ours as the parser goes.
  return pageHead + html.replace(/^\s*<!doctype[^>]*>/i, "");
}

// The card renders a stored page with the viewer's theme.
export function withTheme(page: string, theme: "light" | "dark") {
  return page.replace(/^<!doctype html><html>/, `<!doctype html><html data-theme="${theme}">`);
}
