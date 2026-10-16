import {
  Baby, Briefcase, Bus, Car, Clapperboard, Coffee, Coins, Dumbbell, Fuel, Gift, GraduationCap, HeartPulse, House, Landmark,
  Laptop, type LucideIcon, Music, PawPrint, PiggyBank, Pill, Plane, Receipt, Repeat, Shirt, ShoppingBag, ShoppingCart,
  Smartphone, Sparkles, Tag, Utensils, Wallet, Wifi, Zap,
} from "lucide-react";
import { type CategoryColor, type CategoryIcon as IconKey, lookOf } from "@/lib/modules/categories/look";

export const icons: Record<IconKey, LucideIcon> = {
  cart: ShoppingCart, utensils: Utensils, coffee: Coffee, car: Car, bus: Bus, fuel: Fuel, home: House, bolt: Zap,
  wifi: Wifi, phone: Smartphone, heart: HeartPulse, pill: Pill, bag: ShoppingBag, shirt: Shirt, film: Clapperboard,
  music: Music, repeat: Repeat, plane: Plane, school: GraduationCap, gift: Gift, paw: PawPrint, baby: Baby,
  dumbbell: Dumbbell, sparkles: Sparkles, briefcase: Briefcase, laptop: Laptop, coins: Coins, bank: Landmark,
  piggy: PiggyBank, receipt: Receipt, wallet: Wallet, tag: Tag,
};

// Tokens as CSS variables, so both themes pick their own step.
export const colorVar = (c: CategoryColor) => `var(--cat-${c})`;

const sizes = { sm: "size-8 [&>svg]:size-4", md: "size-10 [&>svg]:size-[1.15rem]", lg: "size-12 [&>svg]:size-6" } as const;

// A tinted disc with the category's icon. Uncategorised rows get a quiet dashed disc.
export function CategoryIcon({
  category,
  size = "md",
  className = "",
}: {
  category: { name: string; icon?: string | null; color?: string | null } | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (!category) {
    return (
      <span aria-hidden className={`grid shrink-0 place-items-center rounded-full border border-dashed border-ash text-ink-soft ${sizes[size]} ${className}`}>
        <Tag strokeWidth={1.8} />
      </span>
    );
  }
  const look = lookOf(category);
  const Icon = icons[look.icon];
  const c = colorVar(look.color);
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
