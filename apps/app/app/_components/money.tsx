import { formatMoney, toNumber } from "@/lib/core/money";

export function Money({
  value,
  currency,
  sign = false,
  tone = false,
  compact = false,
  className = "",
}: {
  value: string | number | null | undefined;
  currency: string;
  sign?: boolean;
  tone?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const n = toNumber(value);
  const color = tone ? (n > 0 ? "text-steel" : n < 0 ? "text-ink" : "text-ink-soft") : "";
  return <span className={`tabular-nums ${color} ${className}`}>{formatMoney(n, currency, { sign, compact })}</span>;
}
