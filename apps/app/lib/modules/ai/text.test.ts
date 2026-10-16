import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleText } from "./text";

test("thought summaries never reach the person", () => {
  const content = [
    { type: "text", text: "Analyzing spending… ", thought: true },
    { type: "text", text: "You spent $4.50." },
  ];
  assert.equal(visibleText(content), "You spent $4.50.");
});

test("plain string content passes through", () => {
  assert.equal(visibleText("ok"), "ok");
});
