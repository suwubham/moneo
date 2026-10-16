"use client";

import { useCallback, useState } from "react";
import { dayLabel } from "@/lib/core/dates";
import { formatMoney, toNumber } from "@/lib/core/money";
import { CategoryIcon } from "../_components/category-icon";
import { Drawer } from "../_components/drawer";
import { type CategoryOption, type Option, TransactionForm, type TxValues } from "./transactions/transaction-form";
import type { Row } from "./transactions/transactions-view";

// The overview's latest transactions; each one opens the same edit drawer as the Transactions page.
export function RecentList({
  rows,
  accounts,
  categories,
  budgets,
  currency,
  today,
}: {
  rows: Row[];
  accounts: Option[];
  categories: CategoryOption[];
  budgets: Option[];
  currency: string;
  today: string;
}) {
  const [editing, setEditing] = useState<{ values: TxValues; key: number } | null>(null);
  const close = useCallback(() => setEditing(null), []);

  return (
    <>
      <ul className="-mx-2 flex flex-col">
        {rows.map((t) => {
          const n = toNumber(t.amount);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() =>
                  setEditing({
                    key: Date.now(),
                    values: {
                      id: t.id,
                      direction: n < 0 ? "out" : "in",
                      amount: Math.abs(n).toFixed(2),
                      description: t.description,
                      occurredOn: t.occurredOn,
                      accountId: t.accountId,
                      categoryId: t.categoryId,
                      note: t.note,
                      budgetId: t.budgetId,
                      excludeFromBudgets: t.excludeFromBudgets,
                    },
                  })
                }
                className="wash flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
              >
                <CategoryIcon category={t.categoryName ? { name: t.categoryName, icon: t.categoryIcon, color: t.categoryColor } : null} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[.95rem] font-semibold">{t.description}</span>
                  <span className="label block truncate">
                    {dayLabel(t.occurredOn, today)} · {t.accountName}
                  </span>
                </span>
                <span className={`shrink-0 text-[.95rem] font-semibold tabular-nums ${n > 0 ? "text-steel" : ""}`}>{formatMoney(n, currency, { sign: n > 0 })}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Drawer open={editing !== null} onClose={close} title="Edit transaction">
        {editing && <TransactionForm key={editing.key} values={editing.values} accounts={accounts} categories={categories} budgets={budgets} onDone={close} />}
      </Drawer>
    </>
  );
}
