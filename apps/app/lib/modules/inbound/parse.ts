import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { shiftDays } from "@/lib/core/dates";
import { amountInput, withSign } from "@/lib/core/money";

// What the model returns for one email. Nothing here is trusted until settleDraft has checked it.
export const draftSchema = z.object({
  isTransaction: z.boolean().describe("true only for money that moved: a purchase, payment, withdrawal, refund, transfer or deposit"),
  direction: z.enum(["out", "in"]).describe("out = money spent or paid, in = money received or refunded"),
  amount: z.string().describe("Positive amount with up to two decimals, digits and dot only, e.g. 140 or 1250.50"),
  currency: z.string().describe("Three-letter currency code from the email, e.g. NPR"),
  occurredOn: z.string().describe("Date of the transaction as YYYY-MM-DD"),
  merchant: z.string().describe("Store, payee or sender exactly as the email names it"),
  description: z.string().describe("Short name for the transaction, from the person's hints when one fits, else the merchant in title case"),
  note: z.string().nullable().describe("Anything a hint says to note, else null"),
  accountId: z.string().nullable().describe("Id from the account list this belongs to, or null if unsure"),
  categoryId: z.string().nullable().describe("Id from the category list that fits, or null"),
});

export type Draft = z.infer<typeof draftSchema>;

export type Settled = {
  // True when every check passed and the transaction can be saved without the person.
  ready: boolean;
  amount: string | null;
  currency: string | null;
  occurredOn: string | null;
  merchant: string | null;
  description: string | null;
  note: string | null;
  accountId: string | null;
  categoryId: string | null;
};

const clip = (s: string | null | undefined, n: number) => s?.trim().slice(0, n) || null;

// Checks the model's reading against the person's own data. Unknown ids become null; a missing account, a bad
// amount or date, or another currency means the person has to look at it.
export function settleDraft(
  draft: Draft,
  ctx: { accountIds: string[]; categoryIds: string[]; currency: string; today: string },
): Settled {
  const plain = draft.amount.replace(/[^\d.]/g, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const amount = amountInput.safeParse(plain);
  const date = z.iso.date().safeParse(draft.occurredOn);
  // A day ahead is fine (time zones); further is a misread.
  const occurredOn = date.success && date.data <= shiftDays(ctx.today, 1) ? date.data : null;
  const currency = /^[A-Za-z]{3}$/.test(draft.currency.trim()) ? draft.currency.trim().toUpperCase() : null;
  const accountId = draft.accountId && ctx.accountIds.includes(draft.accountId) ? draft.accountId : ctx.accountIds.length === 1 ? ctx.accountIds[0] : null;
  const categoryId = draft.categoryId && ctx.categoryIds.includes(draft.categoryId) ? draft.categoryId : null;
  const merchant = clip(draft.merchant, 140);
  const description = clip(draft.description, 140) ?? merchant;
  return {
    ready: Boolean(amount.success && occurredOn && accountId && description && currency === ctx.currency),
    amount: amount.success ? withSign(amount.data, draft.direction) : null,
    currency,
    occurredOn,
    merchant,
    description,
    note: clip(draft.note, 500),
    accountId,
    categoryId,
  };
}

// Gmail sends a code to a new forwarding address before it forwards anything. The person pastes it back into Gmail.
export function gmailForwardingCode(from: string | null | undefined, subject: string | null | undefined, text: string): string | null {
  if (!from?.toLowerCase().includes("forwarding-noreply@google.com")) return null;
  return /confirmation code:\s*(\d{6,})/i.exec(text)?.[1] ?? /\(#(\d{6,})\)/.exec(subject ?? "")?.[1] ?? null;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Good enough to hand a bank's HTML email to a model; not a general HTML-to-text converter.
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (entities[e.toLowerCase()] ?? m),
    )
    .replace(/[ \t]+/g, " ");
}

// "Bank <alerts@bank.com>" → "alerts"; plain "alerts@bank.com" works too.
export function localPart(address: string): string | null {
  const email = /<([^>]+)>/.exec(address)?.[1] ?? address;
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(0, at).trim().toLowerCase() : null;
}

export function domainOf(address: string | null | undefined): string | null {
  const email = /<([^>]+)>/.exec(address ?? "")?.[1] ?? address ?? "";
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).trim().toLowerCase() || null : null;
}

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body" with the base64 secret after "whsec_".
// The signature header may hold several space-separated "v1,<base64>" values while a secret is being rotated.
export function verifySignature(
  secret: string,
  body: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  now = Date.now(),
): boolean {
  if (!h.id || !h.timestamp || !h.signature) return false;
  const sent = Number(h.timestamp);
  // Five minutes either way, so an old request cannot be replayed.
  if (!Number.isFinite(sent) || Math.abs(now / 1000 - sent) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest();
  return h.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
