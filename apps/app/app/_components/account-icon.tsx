import {
  Banknote, Briefcase, Car, Coins, CreditCard, Gift, HeartPulse, House, Landmark, Laptop, type LucideIcon, PiggyBank, Plane,
  Smartphone, TrendingUp, Vault, Wallet,
} from "lucide-react";
import { type AccountIcon as IconKey, type AccountKind, accountLook } from "@/lib/modules/accounts/constants";
import { categoryColors } from "@/lib/modules/categories/look";
import { colorVar } from "./category-icon";

export const accountIconSet: Record<IconKey, LucideIcon> = {
  bank: Landmark, wallet: Wallet, card: CreditCard, piggy: PiggyBank, trending: TrendingUp, banknote: Banknote, coins: Coins,
  safe: Vault, briefcase: Briefcase, home: House, car: Car, plane: Plane, gift: Gift, laptop: Laptop, phone: Smartphone,
  heart: HeartPulse,
};

// A tinted disc with the account's icon, in the colour the person picked (or the kind's default).
export function AccountIcon({ kind, icon, color, className = "" }: { kind: AccountKind; icon?: string | null; color?: string | null; className?: string }) {
  const look = accountLook({ kind, icon, color }, categoryColors);
  const Icon = accountIconSet[look.icon];
  const c = colorVar(look.color as (typeof categoryColors)[number]);
  return (
    <span
      aria-hidden
      className={`grid size-10 shrink-0 place-items-center rounded-full ${className}`}
      style={{ background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }}
    >
      <Icon className="size-[1.15rem]" strokeWidth={1.9} />
    </span>
  );
}
