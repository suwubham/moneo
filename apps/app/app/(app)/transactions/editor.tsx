"use client";

import { ArrowLeftRight } from "lucide-react";
import { plainAmount, toNumber } from "@/lib/core/money";
import { type CategoryOption, type Option, TransactionForm, type TxValues } from "./transaction-form";
import { type AccountOption, TransferForm, type TransferValues } from "./transfer-form";
import type { Row } from "./transactions-view";

export type Editing = { title: string; key: number } & ({ kind: "tx"; values: TxValues } | { kind: "transfer"; values: TransferValues });

// What tapping a row opens: one side of a transfer opens the whole transfer, anything else opens as itself.
export function editorFor(t: Row): Editing {
  const n = toNumber(t.amount);
  const shared = { amount: plainAmount(n), description: t.description, occurredOn: t.occurredOn, note: t.note };
  if (t.transferId) {
    const out = n < 0;
    const other = t.transferAccountId ?? null;
    return {
      kind: "transfer",
      title: "Edit transfer",
      key: Date.now(),
      values: { ...shared, id: t.transferId, fromAccountId: out ? t.accountId : other, toAccountId: out ? other : t.accountId },
    };
  }
  return {
    kind: "tx",
    title: "Edit transaction",
    key: Date.now(),
    values: {
      ...shared,
      id: t.id,
      direction: n < 0 ? "out" : "in",
      accountId: t.accountId,
      categoryId: t.categoryId,
      budgetId: t.budgetId,
      excludeFromBudgets: t.excludeFromBudgets,
    },
  };
}

export function newTransaction(today: string, accounts: Option[], account?: string | null, direction: "out" | "in" = "out"): Editing {
  return {
    kind: "tx",
    title: "New transaction",
    key: Date.now(),
    values: {
      direction,
      amount: "",
      description: "",
      occurredOn: today,
      accountId: account ?? (accounts.length === 1 ? accounts[0].id : null),
      categoryId: null,
      note: null,
    },
  };
}

export function newTransfer(today: string, account?: string | null): Editing {
  return {
    kind: "transfer",
    title: "Move money",
    key: Date.now(),
    values: { fromAccountId: account ?? null, toAccountId: null, amount: "", occurredOn: today, description: "Transfer", note: null },
  };
}

export function EditorForm({
  editing,
  accounts,
  categories,
  budgets,
  currency,
  today,
  onSwitch,
  onDone,
}: {
  editing: Editing;
  accounts: AccountOption[];
  categories: CategoryOption[];
  budgets: Option[];
  currency: string;
  today: string;
  // A new entry can switch between money out, money in and move money (needs at least two accounts).
  onSwitch?: (next: Editing) => void;
  onDone: () => void;
}) {
  const isNew = !editing.values.id;
  if (editing.kind === "transfer") {
    const from = editing.values.fromAccountId;
    const back = onSwitch && isNew ? (d: "out" | "in") => onSwitch(newTransaction(today, accounts, from, d)) : undefined;
    return <TransferForm key={editing.key} values={editing.values} accounts={accounts} currency={currency} onSwitch={back} onDone={onDone} />;
  }
  const account = editing.values.accountId;
  const move = onSwitch && isNew && accounts.length > 1 ? () => onSwitch(newTransfer(today, account)) : undefined;
  return (
    <TransactionForm key={editing.key} values={editing.values} accounts={accounts} categories={categories} budgets={budgets} onMoveMoney={move} onDone={onDone} />
  );
}

const sizes = { sm: "size-8 [&>svg]:size-4", md: "size-10 [&>svg]:size-[1.15rem]" } as const;

// Stands in for the category icon on a transfer row.
export function TransferIcon({ size = "md" }: { size?: keyof typeof sizes }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full border border-line bg-night-3 text-ink-soft ${sizes[size]}`}>
      <ArrowLeftRight />
    </span>
  );
}

// "to Savings" on the side money leaves, "from Everyday" on the side it arrives.
export function transferLabel(t: Pick<Row, "amount" | "transferAccountName">) {
  if (!t.transferAccountName) return "transfer";
  return toNumber(t.amount) < 0 ? `transfer to ${t.transferAccountName}` : `transfer from ${t.transferAccountName}`;
}
