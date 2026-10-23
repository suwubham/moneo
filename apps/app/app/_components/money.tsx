import { formatMoney, toNumber } from "@/lib/core/money";
import { type AccountKind, isOwed } from "@/lib/modules/accounts/constants";

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

// An account's balance in words that fit it: a card or loan shows what you owe, not a minus balance.
export function balanceText(kind: AccountKind, balance: string | number, currency: string) {
  const n = toNumber(balance);
  if (!isOwed(kind)) return formatMoney(n, currency);
  if (n < 0) return `${formatMoney(-n, currency)} owed`;
  return n > 0 ? `${formatMoney(n, currency)} in credit` : "nothing owed";
}

export function AccountBalance({ kind, balance, currency, className = "" }: { kind: AccountKind; balance: string | number; currency: string; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{balanceText(kind, balance, currency)}</span>;
}

// "have · owe" under a net figure, shown once there is a card or loan to tell apart.
export function HaveOwe({ split, currency, className = "" }: { split: { have: number; owed: number; hasOwed: boolean }; currency: string; className?: string }) {
  if (!split.hasOwed) return null;
  return (
    <span className={`label ${className}`}>
      you have <Money value={split.have} currency={currency} className="text-ink" /> · you owe <Money value={split.owed} currency={currency} className="text-ink" />
    </span>
  );
}
