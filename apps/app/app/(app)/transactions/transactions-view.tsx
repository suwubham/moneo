"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { formatMoney, toNumber } from "@/lib/core/money";
import { CategoryIcon } from "../../_components/category-icon";
import { Drawer } from "../../_components/drawer";
import { badge, btnPrimary, btnSoft, card } from "../../_components/styles";
import { draftTransactionAction } from "./actions";
import { FilterBar } from "./filter-bar";
import { type CategoryOption, type Option, TransactionForm, type TxValues } from "./transaction-form";

export type Row = {
  id: string;
  amount: string;
  occurredOn: string;
  description: string;
  note: string | null;
  accountId: string;
  accountName: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgetId: string | null;
  budgetName: string | null;
  excludeFromBudgets: boolean;
};

export type Group = { day: string; label: string; rows: Row[]; cents: number };

type Props = {
  groups: Group[];
  accounts: Option[];
  categories: CategoryOption[];
  budgets: Option[];
  currency: string;
  today: string;
  aiOn: boolean;
  // On an account's own page, new transactions start in that account and rows skip its name.
  defaultAccount?: string;
  showAccount?: boolean;
  filters: React.ComponentProps<typeof FilterBar>;
  toolbar: React.ReactNode;
  footer: React.ReactNode;
};

const row =
  "wash grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3.5 px-4 py-3 text-left outline-offset-[-2px] sm:px-5";

function blank(today: string, accounts: Option[], account?: string): TxValues {
  return {
    direction: "out",
    amount: "",
    description: "",
    occurredOn: today,
    accountId: account ?? (accounts.length === 1 ? accounts[0].id : null),
    categoryId: null,
    note: null,
  };
}

export function TransactionsView({ groups, accounts, categories, budgets, currency, today, aiOn, defaultAccount, showAccount = true, filters, toolbar, footer }: Props) {
  const [editing, setEditing] = useState<{ title: string; values: TxValues; key: number } | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const open = useCallback((title: string, values: TxValues) => setEditing({ title, values, key: Date.now() }), []);

  // "n" opens a new transaction from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey || el.closest("input, textarea, select, [contenteditable], dialog")) return;
      if (accounts.length === 0) return;
      e.preventDefault();
      open("New transaction", blank(today, accounts, defaultAccount));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [accounts, today, defaultAccount, open]);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        {aiOn && <QuickAdd onDraft={(v) => open("Check and save", { ...v, accountId: v.accountId ?? defaultAccount ?? null })} />}
        <button
          type="button"
          className={btnPrimary}
          disabled={accounts.length === 0}
          onClick={() => open("New transaction", blank(today, accounts, defaultAccount))}
          aria-keyshortcuts="n"
        >
          <Plus className="size-4" aria-hidden /> Add transaction
          <kbd className="hidden rounded border border-on-accent/30 px-1.5 font-mono text-[.7rem] lg:inline">n</kbd>
        </button>
      </div>

      <div className="mb-4">
        <FilterBar {...filters} />
      </div>
      <div>{toolbar}</div>

      {groups.length > 0 && (
        <div className={`${card} overflow-clip`}>
          {groups.map((g, gi) => (
            <section key={g.day} aria-label={g.label} className={gi > 0 ? "border-t border-line" : ""}>
              <h2 className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-line bg-night-2/95 px-4 py-2 sm:px-5 md:top-20">
                <span className="label text-ink">{g.label}</span>
                <span className="label tabular-nums">{formatMoney(g.cents / 100, currency, { sign: g.cents > 0 })}</span>
              </h2>
              <ul className="rise divide-y divide-line">
                {g.rows.map((t, i) => {
                  const n = toNumber(t.amount);
                  return (
                    <li key={t.id} style={{ "--i": i } as React.CSSProperties}>
                      <button
                        type="button"
                        className={row}
                        onClick={() =>
                          open("Edit transaction", {
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
                          })
                        }
                      >
                        <CategoryIcon category={t.categoryName ? { name: t.categoryName, icon: t.categoryIcon, color: t.categoryColor } : null} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.description}</span>
                          <span className="label flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{t.categoryName ?? "uncategorised"}</span>
                            {showAccount && <span className="hidden truncate sm:inline">· {t.accountName}</span>}
                            {t.budgetName && (
                              <span className="hidden sm:inline">
                                <span className={badge}>{t.budgetName}</span>
                              </span>
                            )}
                            {t.excludeFromBudgets && (
                              <span className="hidden sm:inline">
                                <span className={badge}>not in budgets</span>
                              </span>
                            )}
                          </span>
                        </span>
                        <span className={`text-right font-semibold tabular-nums ${n > 0 ? "text-steel" : ""}`}>{formatMoney(n, currency, { sign: n > 0 })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div>{footer}</div>

      <Drawer open={editing !== null} onClose={close} title={editing?.title ?? ""}>
        {editing && (
          <>
            {editing.values.id && (
              <Link
                href={`/assistant?q=${encodeURIComponent(`Tell me about my "${editing.values.description}" spending. How often and how much?`)}`}
                className="label mb-5 inline-block underline"
              >
                ask the assistant about this →
              </Link>
            )}
            <TransactionForm key={editing.key} values={editing.values} accounts={accounts} categories={categories} budgets={budgets} onDone={close} />
          </>
        )}
      </Drawer>
    </>
  );
}

function QuickAdd({ onDraft }: { onDraft: (v: TxValues) => void }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<ActionState<unknown>>(null);
  const [busy, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await draftTransactionAction(text);
      setState(res);
      if (res?.ok && res.data) {
        onDraft({ ...res.data, note: null });
        setText("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex-1">
      <label htmlFor="quick" className="sr-only">
        Describe a transaction
      </label>
      <div className="flex items-center gap-2 rounded-full border border-line bg-night-2 p-1.5 pl-5 focus-within:border-steel">
        <span aria-hidden className="fancy shrink-0 text-[1.1rem] whitespace-nowrap text-scene">
          say it
        </span>
        <input
          id="quick"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="coffee 4.50 yesterday on my visa"
          maxLength={300}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[.95rem] text-ink outline-none placeholder:text-ash"
        />
        <button type="submit" disabled={busy || text.trim().length < 2} className={btnSoft}>
          {busy ? "reading…" : "Fill the form"}
        </button>
      </div>
      {state && !state.ok && <p className="mt-2 pl-5 text-[.85rem] text-accent">{state.error.message}</p>}
    </form>
  );
}
