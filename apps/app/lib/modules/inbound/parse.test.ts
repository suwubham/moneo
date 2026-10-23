import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, test } from "node:test";
import { domainOf, gmailForwardingCode, htmlToText, localPart, settleDraft, verifySignature } from "./parse";

const ctx = { accountIds: ["acc-1", "acc-2"], categoryIds: ["cat-1"], currency: "NPR", today: "2026-10-23" };
const draft = {
  isTransaction: true,
  direction: "out" as const,
  amount: "140.0",
  currency: "npr",
  occurredOn: "2026-10-23",
  merchant: "Corner Store",
  description: "Snacks",
  note: null,
  accountId: "acc-1",
  categoryId: "cat-1",
};

describe("checking the model's reading", () => {
  test("a clean reading is ready to save", () => {
    assert.deepEqual(settleDraft(draft, ctx), {
      ready: true,
      amount: "-140",
      currency: "NPR",
      occurredOn: "2026-10-23",
      merchant: "Corner Store",
      description: "Snacks",
      note: null,
      accountId: "acc-1",
      categoryId: "cat-1",
    });
  });

  test("money in stays positive, and amounts lose commas", () => {
    const s = settleDraft({ ...draft, direction: "in", amount: "1,250.50" }, ctx);
    assert.equal(s.amount, "1250.5");
  });

  test("ids the person does not own are dropped", () => {
    const s = settleDraft({ ...draft, accountId: "someone-else", categoryId: "nope" }, ctx);
    assert.equal(s.accountId, null);
    assert.equal(s.categoryId, null);
    assert.equal(s.ready, false);
  });

  test("with one account, that account is used", () => {
    const s = settleDraft({ ...draft, accountId: null }, { ...ctx, accountIds: ["only"] });
    assert.equal(s.accountId, "only");
    assert.equal(s.ready, true);
  });

  test("a bad amount, a future date or another currency waits for the person", () => {
    assert.equal(settleDraft({ ...draft, amount: "12.345" }, ctx).ready, false);
    assert.equal(settleDraft({ ...draft, amount: "0" }, ctx).ready, false);
    assert.equal(settleDraft({ ...draft, occurredOn: "2026-11-30" }, ctx).ready, false);
    assert.equal(settleDraft({ ...draft, occurredOn: "23/10/2026" }, ctx).ready, false);
    assert.equal(settleDraft({ ...draft, currency: "USD" }, ctx).ready, false);
  });

  test("an empty description falls back to the merchant", () => {
    assert.equal(settleDraft({ ...draft, description: "  " }, ctx).description, "Corner Store");
  });
});

describe("email helpers", () => {
  test("finds Gmail's confirm link, not the cancel link", () => {
    const link = "https://mail.google.com/mail/vf-%5BABC_def-123%5D-xyz";
    const text = `please click the link below to confirm the request:\n\n${link}\n\nto cancel this verification:\nhttps://mail.google.com/mail/uf-%5BNOPE%5D`;
    assert.equal(gmailForwardingCode("forwarding-noreply@google.com", "(Gmail Forwarding Confirmation - Receive Mail from someone", text), link);
    assert.equal(gmailForwardingCode("forwarding-noreply@google.com", "Gmail Forwarding Confirmation", "https://evil.example/mail/vf-x"), null);
  });

  test("finds Gmail's older forwarding code only in Gmail's email", () => {
    const text = "Confirmation code: 123456789\nTo allow forwarding, click the link below.";
    assert.equal(gmailForwardingCode("Gmail Team <forwarding-noreply@google.com>", "(#123456789) Gmail Forwarding Confirmation", text), "123456789");
    assert.equal(gmailForwardingCode("forwarding-noreply@google.com", "(#987654321) Gmail Forwarding Confirmation", "no code here"), "987654321");
    assert.equal(gmailForwardingCode("someone@example.com", "(#123456789)", text), null);
  });

  test("turns HTML into text a pattern can read", () => {
    const html = "<style>p{}</style><p>card 1234 was used&nbsp;at <b>A &amp; B</b></p><br>next";
    assert.equal(htmlToText(html).replace(/\s+/g, " ").trim(), "card 1234 was used at A & B next");
  });

  test("addresses", () => {
    assert.equal(localPart("Moneo <AbC123@in.example.com>"), "abc123");
    assert.equal(localPart("abc123@in.example.com"), "abc123");
    assert.equal(localPart("not an address"), null);
    assert.equal(domainOf("Bank Alerts <alerts@Bank.example>"), "bank.example");
    assert.equal(domainOf(null), null);
  });
});

describe("webhook signature", () => {
  const secret = `whsec_${Buffer.from("a test secret of some length").toString("base64")}`;
  const body = '{"type":"email.received"}';
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);
  const sign = (b: string) =>
    createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`msg_1.${ts}.${b}`).digest("base64");

  test("accepts Resend's signature, including one of several", () => {
    assert.ok(verifySignature(secret, body, { id: "msg_1", timestamp: ts, signature: `v1,${sign(body)}` }, now));
    assert.ok(verifySignature(secret, body, { id: "msg_1", timestamp: ts, signature: `v1,bm9wZQ== v1,${sign(body)}` }, now));
  });

  test("refuses a changed body, an old request or missing headers", () => {
    assert.equal(verifySignature(secret, `${body} `, { id: "msg_1", timestamp: ts, signature: `v1,${sign(body)}` }, now), false);
    assert.equal(verifySignature(secret, body, { id: "msg_1", timestamp: ts, signature: `v1,${sign(body)}` }, now + 10 * 60_000), false);
    assert.equal(verifySignature(secret, body, { id: null, timestamp: ts, signature: `v1,${sign(body)}` }, now), false);
  });
});
