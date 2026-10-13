import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { autoDecision } from "../db/migrate";
import { dayLabel, monthOf, shiftMonth } from "./dates";
import { amountInput, formatMoney, withSign } from "./money";

describe("dates", () => {
  test("a month is a half-open range that rolls into the next year", () => {
    assert.deepEqual(monthOf("2026-12"), { key: "2026-12", start: "2026-12-01", end: "2027-01-01" });
  });

  test("shifting months crosses year boundaries both ways", () => {
    assert.equal(shiftMonth("2026-01", -1).key, "2025-12");
    assert.equal(shiftMonth("2025-11", 3).key, "2026-02");
  });

  test("recent days get friendly labels", () => {
    assert.equal(dayLabel("2026-10-08", "2026-10-08"), "Today");
    assert.equal(dayLabel("2026-10-07", "2026-10-08"), "Yesterday");
    assert.equal(dayLabel("2026-10-01", "2026-10-08"), "Thu, Oct 1");
  });
});

describe("money", () => {
  test("amounts accept commas and refuse zero, negatives and three decimals", () => {
    assert.equal(amountInput.parse("1,234.50"), "1234.50");
    assert.equal(amountInput.safeParse("0").success, false);
    assert.equal(amountInput.safeParse("-4").success, false);
    assert.equal(amountInput.safeParse("1.234").success, false);
  });

  test("money out is stored negative", () => {
    assert.equal(withSign("4.50", "out"), "-4.50");
    assert.equal(withSign("4.50", "in"), "4.50");
  });

  test("formatting uses the profile currency", () => {
    assert.equal(formatMoney("-12.5", "USD"), "-$12.50");
    assert.equal(formatMoney(3, "USD", { sign: true }), "+$3.00");
  });
});

describe("automatic migrations", () => {
  const url = "postgres://u:p@ep-prod-123.neon.tech/db";

  test("production never migrates from the build", () => {
    assert.equal(autoDecision({ url, vercelEnv: "production" }).run, false);
  });

  test("previews refuse the production database", () => {
    assert.equal(autoDecision({ url, vercelEnv: "preview", productionDbHost: "ep-prod-123.neon.tech" }).run, false);
  });

  test("previews refuse when they cannot prove they are safe", () => {
    assert.equal(autoDecision({ url, vercelEnv: "preview" }).run, false);
  });

  test("previews on their own branch migrate", () => {
    const branch = "postgres://u:p@ep-branch-9.neon.tech/db";
    assert.equal(autoDecision({ url: branch, vercelEnv: "preview", productionDbHost: "ep-prod-123.neon.tech" }).run, true);
  });

  test("local runs migrate, and skip without a database", () => {
    assert.equal(autoDecision({ url }).run, true);
    assert.equal(autoDecision({}).run, false);
  });
});
