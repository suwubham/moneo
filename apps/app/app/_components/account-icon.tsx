import { Banknote, CreditCard, Landmark, type LucideIcon, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import type { AccountKind } from "@/lib/modules/accounts/constants";

const icons: Record<AccountKind, LucideIcon> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Wallet,
  investment: TrendingUp,
  loan: Banknote,
};

export function AccountIcon({ kind, className = "" }: { kind: AccountKind; className?: string }) {
  const Icon = icons[kind];
  return (
    <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full border border-line bg-night-3 text-steel ${className}`}>
      <Icon className="size-[1.15rem]" strokeWidth={1.9} />
    </span>
  );
}
