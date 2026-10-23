import { z } from "zod";

export const amountInput = z
  .string()
  .trim()
  .transform((s) => s.replace(/[,\s]/g, ""))
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Use a positive amount with up to two decimals."))
  .refine((s) => Number(s) > 0, "Amount must be more than zero.");

export const signedAmountInput = z
  .string()
  .trim()
  .transform((s) => s.replace(/[,\s]/g, ""))
  .pipe(z.string().regex(/^-?\d{1,12}(\.\d{1,2})?$/, "Use a number with up to two decimals."));

export type Direction = "out" | "in";

export function withSign(amount: string, direction: Direction): string {
  return direction === "out" ? `-${amount}` : amount;
}

// A card or loan stores what you owe as a negative balance; the form asks for it as a plain amount.
export function asOwed(amount: string): string {
  const plain = amount.replace(/^-/, "");
  return Number(plain) === 0 ? "0" : `-${plain}`;
}

export function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: string | number | null | undefined, currency: string, opts: { sign?: boolean; compact?: boolean } = {}) {
  const n = toNumber(value);
  const f = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    signDisplay: opts.sign ? "exceptZero" : "auto",
    notation: opts.compact && Math.abs(n) >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 0 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  });
  return f.format(n);
}

export const currencies = ["USD", "EUR", "GBP", "INR", "NPR", "AUD", "CAD", "JPY", "SGD", "AED", "CHF", "NZD"] as const;
