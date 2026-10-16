"use client";

import { CloudOff, Plus, RotateCw } from "lucide-react";
import { useCallback, useState } from "react";
import { dayLabel } from "@/lib/core/dates";
import { formatMoney, toNumber } from "@/lib/core/money";
import { type TxValues, TransactionForm } from "../(app)/transactions/transaction-form";
import { AccountIcon } from "../_components/account-icon";
import { CategoryIcon } from "../_components/category-icon";
import { Drawer } from "../_components/drawer";
import { PendingChanges } from "../_components/pending-changes";
import { btnPrimary, btnSoft, card, tile } from "../_components/styles";
import { SyncProvider, useSync } from "../_components/sync-provider";

const ago = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function since(iso: string) {
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (Math.abs(mins) < 60) return ago.format(mins, "minute");
  if (Math.abs(mins) < 60 * 24) return ago.format(Math.round(mins / 60), "hour");
  return ago.format(Math.round(mins / 1440), "day");
}

// What Moneo can show with no connection: the last copy this device saved, plus anything added since.
export function OfflineApp() {
  const { ready, snapshot } = useSync();
  const [editing, setEditing] = useState<{ title: string; values: TxValues; key: number } | null>(null);
  const close = useCallback(() => setEditing(null), []);

  const back = () => {
    const from = new URLSearchParams(location.search).get("from");
    location.href = from?.startsWith("/") && !from.startsWith("//") ? from : "/";
  };

  const header = (
    <header className="rise-1 mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label mb-2 flex items-center gap-2 text-scene">
          <CloudOff className="size-4" aria-hidden /> no connection
        </p>
        <h1 className="text-[clamp(2.1rem,4.6vw,3.4rem)] leading-[0.95] font-extrabold tracking-[-0.05em]">
          You&apos;re <span className="fancy tracking-[-0.03em] text-scene">offline.</span>
        </h1>
        {snapshot && <p className="mt-2 text-ink-soft">Showing what this device saved {since(snapshot.asOf)}. New transactions sync when you&apos;re back.</p>}
      </div>
      <button type="button" className={btnSoft} onClick={back}>
        <RotateCw className="size-4" aria-hidden /> Try again
      </button>
    </header>
  );

  if (!ready) return <SyncProvider />;
  if (!snapshot) {
    return (
      <>
        <SyncProvider />
        {header}
        <p className="max-w-[48ch] text-ink-soft">This device has no saved copy yet. Open Moneo once while online and it will keep one for times like this.</p>
      </>
    );
  }

  const cur = snapshot.currency;
  const accounts = snapshot.accounts.filter((a) => !a.archived);
  const net = accounts.reduce((s, a) => s + toNumber(a.balance), 0);
  const options = accounts.map((a) => ({ id: a.id, name: a.name }));
  const categories = snapshot.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }));
  const today = snapshot.today;
  const blank: TxValues = {
    direction: "out",
    amount: "",
    description: "",
    occurredOn: new Date().toLocaleDateString("en-CA"),
    accountId: options.length === 1 ? options[0].id : null,
    categoryId: null,
    note: null,
  };

  return (
    <>
      <SyncProvider />
      {header}

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btnPrimary} onClick={() => setEditing({ title: "New transaction", values: blank, key: Date.now() })}>
            <Plus className="size-4" aria-hidden /> Add transaction
          </button>
          <span className="label">saved on this device until you&apos;re online</span>
        </div>

        <PendingChanges categories={categories} accounts={options} currency={cur} />

        <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr]">
          <section className={`${tile} flex flex-col gap-4 rounded-[2.4rem_1.2rem_2.4rem_1.2rem]`} aria-labelledby="off-accounts">
            <h2 id="off-accounts" className="label">
              net worth · {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </h2>
            <p className="text-[clamp(2rem,4.5vw,3rem)] leading-none font-extrabold tracking-[-0.045em]">{formatMoney(net, cur)}</p>
            <ul className="flex flex-col divide-y divide-line">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <AccountIcon kind={a.kind} icon={a.icon} color={a.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
                  <span className="font-semibold tabular-nums">{formatMoney(a.balance, cur)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${tile} flex flex-col gap-3`} aria-labelledby="off-budgets">
            <h2 id="off-budgets" className="label">
              budgets this month
            </h2>
            {snapshot.budgets.length === 0 ? (
              <p className="text-ink-soft">None set.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {snapshot.budgets.map((b) => {
                  const ratio = toNumber(b.amount) > 0 ? toNumber(b.spent) / toNumber(b.amount) : 0;
                  return (
                    <li key={b.id}>
                      <span className="flex justify-between gap-2 text-[.92rem]">
                        <span className="truncate">{b.name}</span>
                        <span className={`tabular-nums ${ratio > 1 ? "text-accent" : "text-ink-soft"}`}>{Math.round(ratio * 100)}%</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-night">
                        <span
                          className={`grow-x block h-full origin-left rounded-full ${ratio > 1 ? "bg-accent" : ratio >= 0.8 ? "bg-amber" : "bg-steel"}`}
                          style={{ transform: `scaleX(${Math.min(1, ratio)})` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section aria-labelledby="off-recent">
          <h2 id="off-recent" className="label mb-2 pl-1">
            recent transactions · tap one to edit
          </h2>
          <ul className={`${card} divide-y divide-line overflow-hidden`}>
            {snapshot.transactions.slice(0, 60).map((t) => {
              const n = toNumber(t.amount);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className="wash grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3.5 px-4 py-3 text-left sm:px-5"
                    onClick={() =>
                      setEditing({
                        title: "Edit transaction",
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
                  >
                    <CategoryIcon category={t.categoryName ? { name: t.categoryName, icon: t.categoryIcon, color: t.categoryColor } : null} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{t.description}</span>
                      <span className="label block truncate">
                        {dayLabel(t.occurredOn, today)} · {t.accountName}
                      </span>
                    </span>
                    <span className={`font-semibold tabular-nums ${n > 0 ? "text-steel" : ""}`}>{formatMoney(n, cur, { sign: n > 0 })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <Drawer open={editing !== null} onClose={close} title={editing?.title ?? ""}>
        {editing && <TransactionForm key={editing.key} values={editing.values} accounts={options} categories={categories} budgets={snapshot.picked} queue onDone={close} />}
      </Drawer>
    </>
  );
}
