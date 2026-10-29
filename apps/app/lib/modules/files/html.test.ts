import assert from "node:assert/strict";
import { test } from "node:test";
import { pageCsp, pageHead, withTheme, wrapHtml } from "./html";

test("our no-network policy comes before anything the model wrote", () => {
  const page = wrapHtml(`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><script src="https://evil.example/x.js"></script></head><body>hi</body></html>`);
  assert.ok(page.startsWith(pageHead));
  assert.ok(page.indexOf(pageCsp) < page.indexOf("default-src *"));
  assert.equal(page.match(/<!doctype/gi)?.length, 1);
  assert.match(pageCsp, /default-src 'none'/);
});

test("a fragment without its own document is wrapped too", () => {
  assert.equal(wrapHtml("<svg></svg>"), `${pageHead}<svg></svg>`);
});

test("the card shows a stored page in the viewer's theme", () => {
  const page = wrapHtml("<p>x</p>");
  assert.ok(withTheme(page, "light").startsWith(`<!doctype html><html data-theme="light"><head>`));
  assert.equal(withTheme("<p>not ours</p>", "light"), "<p>not ours</p>");
});

test("the app's fonts go in after our policy, never before it", () => {
  const page = withTheme(wrapHtml("<p>x</p>"), "dark", "@font-face{font-family:\"Moneo Sans\"}");
  assert.ok(page.startsWith(`<!doctype html><html data-theme="dark"><head>`));
  assert.ok(page.indexOf(pageCsp) < page.indexOf("@font-face"));
  assert.ok(page.indexOf(pageCsp) < page.indexOf("overflow:hidden!important"));
  assert.ok(page.endsWith("<p>x</p>"));
});
