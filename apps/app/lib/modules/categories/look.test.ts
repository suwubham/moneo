import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { guessLook, lookOf, nearestColor } from "./look";

describe("category look", () => {
  test("guesses an icon from the name", () => {
    assert.equal(guessLook("Groceries").icon, "cart");
    assert.equal(guessLook("Dining out").icon, "utensils");
    assert.equal(guessLook("Salary").icon, "briefcase");
    assert.equal(guessLook("Zzz").icon, "tag");
  });

  test("an unknown name still gets the same colour every time", () => {
    assert.equal(guessLook("Zzz").color, guessLook("zzz").color);
  });

  test("a saved look wins, and junk falls back to the guess", () => {
    assert.deepEqual(lookOf({ name: "Groceries", icon: "gift", color: "violet" }), { icon: "gift", color: "violet" });
    assert.deepEqual(lookOf({ name: "Groceries", icon: "nope", color: "#fff" }), guessLook("Groceries"));
  });

  test("Cashew colours snap to the nearest hue, greys to none", () => {
    assert.equal(nearestColor("0xff4caf50"), "green");
    assert.equal(nearestColor("0xfff44336"), "red");
    assert.equal(nearestColor("0xff2196f3"), "blue");
    assert.equal(nearestColor("0xff9e9e9e"), null);
    assert.equal(nearestColor(null), null);
  });
});
