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

// Credit cards and loans hold money you owe. Their balance is negative while you owe, and totals keep them apart
// from the money you have.
export const owedKinds: readonly AccountKind[] = ["credit", "loan"];
export const isOwed = (kind: AccountKind) => owedKinds.includes(kind);

// What you have, what you owe (a positive number), and the two together. Whole cents, so the sums are exact.
export function balanceSplit(accounts: { kind: AccountKind; balance: string | number }[]) {
  let have = 0;
  let owed = 0;
  for (const a of accounts) {
    const cents = Math.round(Number(a.balance) * 100) || 0;
    // A card paid past zero is in credit: that is money you have, not a negative debt.
    if (isOwed(a.kind) && cents < 0) owed -= cents;
    else have += cents;
  }
  return { have: have / 100, owed: owed / 100, net: (have - owed) / 100, hasOwed: accounts.some((a) => isOwed(a.kind)) };
}

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
