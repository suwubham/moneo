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

const sizes = { xs: "size-6 [&>svg]:size-3.5", sm: "size-9 [&>svg]:size-4", md: "size-10 [&>svg]:size-[1.15rem]", lg: "size-12 [&>svg]:size-6" } as const;

// A tinted disc with the account's icon, in the colour the person picked (or the kind's default).
export function AccountIcon({
  kind,
  icon,
  color,
  size = "md",
  className = "",
}: {
  kind: AccountKind;
  icon?: string | null;
  color?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const look = accountLook({ kind, icon, color }, categoryColors);
  const Icon = accountIconSet[look.icon];
  const c = colorVar(look.color as (typeof categoryColors)[number]);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${sizes[size]} ${className}`}
      style={{ background: `color-mix(in srgb, ${c} 18%, transparent)`, color: c }}
    >
      <Icon strokeWidth={1.9} />
    </span>
  );
}
