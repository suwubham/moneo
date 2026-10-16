export const accountKinds = ["checking", "savings", "credit", "cash", "investment", "loan"] as const;
export type AccountKind = (typeof accountKinds)[number];

export const kindLabels: Record<AccountKind, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit card",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
};

// How an account looks: an icon key and a data colour (the same palette categories use).
export const accountIcons = ["bank", "wallet", "card", "piggy", "trending", "banknote", "coins", "safe", "briefcase", "home", "car", "plane", "gift", "laptop", "phone", "heart"] as const;
export type AccountIcon = (typeof accountIcons)[number];

const kindLook: Record<AccountKind, { icon: AccountIcon; color: string }> = {
  checking: { icon: "bank", color: "blue" },
  savings: { icon: "piggy", color: "green" },
  credit: { icon: "card", color: "violet" },
  cash: { icon: "wallet", color: "yellow" },
  investment: { icon: "trending", color: "aqua" },
  loan: { icon: "banknote", color: "red" },
};

export function accountLook(a: { kind: AccountKind; icon?: string | null; color?: string | null }, colors: readonly string[]) {
  const base = kindLook[a.kind];
  return {
    icon: (accountIcons as readonly string[]).includes(a.icon ?? "") ? (a.icon as AccountIcon) : base.icon,
    color: colors.includes(a.color ?? "") ? (a.color as string) : base.color,
  };
}
