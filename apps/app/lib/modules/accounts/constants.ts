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
