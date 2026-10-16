"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { formatMoney } from "@/lib/core/money";
import { BudgetMonths } from "../_components/budget-months";
import { BudgetHistory, type HistoryPoint } from "../_components/charts";
import { Drawer } from "../_components/drawer";
import { btn } from "../_components/styles";

type Peek = { id: string; name: string; kind: "category" | "total" | "picked"; categoryId: string | null; amount: string };

function txHref(b: Peek, month: string) {
  if (b.kind === "picked") return `/transactions?month=${month}&budget=${b.id}`;
  if (b.kind === "category") return `/transactions?month=${month}&category=${b.categoryId}`;
  return `/transactions?month=${month}`;
}

// A budget row on the overview that opens its last six months side by side.
export function BudgetPeek({
  budget,
  history,
  currency,
  className,
  children,
}: {
  budget: Peek;
  history: HistoryPoint[];
  currency: string;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const limit = Number(budget.amount);
  const months = history.filter((h) => h.spent > 0);
  const avg = months.length ? months.reduce((s, h) => s + h.spent, 0) / months.length : 0;
  const overCount = history.filter((h) => h.spent > limit).length;

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Drawer open={open} onClose={close} title={budget.name}>
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["limit", formatMoney(limit, currency, { compact: true })],
              ["average", formatMoney(avg, currency, { compact: true })],
              ["months over", `${overCount} of ${history.length}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-[1.1rem] border border-line bg-night px-3.5 py-3">
                <dt className="label">{k}</dt>
                <dd className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em]">{v}</dd>
              </div>
            ))}
          </dl>
          <section aria-label="Last six months" className="rounded-[1.1rem] border border-line bg-night p-4">
            <p className="label mb-2">last six months, against today&apos;s limit</p>
            <BudgetHistory data={history} limit={limit} currency={currency} />
          </section>
          <section aria-label="Month by month">
            <p className="label mb-1">month by month · tap one for its transactions</p>
            <BudgetMonths history={history} limit={limit} currency={currency} href={(m) => txHref(budget, m)} />
          </section>
          <div>
            <Link href="/budgets" className={btn}>
              edit on the budgets page
            </Link>
          </div>
        </div>
      </Drawer>
    </>
  );
}
