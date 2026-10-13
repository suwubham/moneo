"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { formatMoney, toNumber } from "@/lib/core/money";
import { Drawer } from "../../_components/drawer";
import { badge, btnPrimary, btnSoft, card } from "../../_components/styles";
import { draftTransactionAction } from "./actions";
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
};

export type Group = { day: string; label: string; rows: Row[] };

type Props = {
  groups: Group[];
  accounts: Option[];
  categories: CategoryOption[];
  currency: string;
  today: string;
  aiOn: boolean;
  toolbar: React.ReactNode;
  footer: React.ReactNode;
};

const row =
  "group relative grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 overflow-hidden px-4 py-3 text-left transition-colors duration-300 ease-soft hover:bg-night-3 sm:px-5";

function blank(today: string, accounts: Option[]): TxValues {
  return {
    direction: "out",
    amount: "",
    description: "",
    occurredOn: today,
    accountId: accounts.length === 1 ? accounts[0].id : null,
    categoryId: null,
    note: null,
  };
}

export function TransactionsView({ groups, accounts, categories, currency, today, aiOn, toolbar, footer }: Props) {
  const [editing, setEditing] = useState<{ title: string; values: TxValues; key: number } | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const open = (title: string, values: TxValues) => setEditing({ title, values, key: Date.now() });

  return (
    <>
      <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        {aiOn && <QuickAdd onDraft={(v) => open("Check and save", v)} />}
        <button type="button" className={btnPrimary} disabled={accounts.length === 0} onClick={() => open("New transaction", blank(today, accounts))}>
          Add transaction
        </button>
      </div>

      {toolbar}

      {groups.length > 0 && (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.day} aria-label={g.label}>
              <h2 className="label mb-2 pl-1">{g.label}</h2>
              <ul className={`${card} divide-y divide-line overflow-hidden`}>
                {g.rows.map((t) => {
                  const n = toNumber(t.amount);
                  return (
                    <li key={t.id}>
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
                          })
                        }
                      >
                        <span className="truncate font-semibold">{t.description}</span>
                        <span className={`text-right font-semibold tabular-nums ${n > 0 ? "text-steel" : ""}`}>
                          {formatMoney(n, currency, { sign: n > 0 })}
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={badge}>{t.categoryName ?? "uncategorised"}</span>
                          <span className="label truncate">{t.accountName}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {footer}

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
            <TransactionForm key={editing.key} values={editing.values} accounts={accounts} categories={categories} onDone={close} />
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
