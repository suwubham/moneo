"use client";

import { useState, useTransition } from "react";
import { dayLabel } from "@/lib/core/dates";
import { formatMoney, toNumber } from "@/lib/core/money";
import { isOwed, kindLabels } from "@/lib/modules/accounts/constants";
import type { AccountView, ChangeView, TxView } from "@/lib/modules/assistant/change-view";
import type { ChangeStatus } from "@/lib/modules/assistant/schema";
import { badge, btn } from "../../_components/styles";
import { saveChangesAction, skipChangeAction } from "./actions";

const verbs: Record<ChangeView["kind"], string> = {
  add_transaction: "add",
  edit_transaction: "change",
  delete_transaction: "delete",
  add_account: "new account",
  edit_account: "change account",
  delete_account: "delete account",
};

const saveAllBtn =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-ink px-4 text-[.85rem] font-semibold text-night transition-[translate,scale,opacity] duration-300 ease-soft hover:-translate-y-0.5 active:scale-[.97] active:duration-100 disabled:pointer-events-none disabled:opacity-50";

// Suggested changes under an assistant reply. Nothing is written until the person taps Save.
// `ready` is false while the reply is still streaming, or if it stopped before the suggestions were stored.
export function ChangeCard({ changes, currency, today, ready, lost }: { changes: ChangeView[]; currency: string; today: string; ready: boolean; lost?: boolean }) {
  const [status, setStatus] = useState<Record<string, ChangeStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const statusOf = (c: ChangeView) => status[c.id] ?? c.status;
  const pending = changes.filter((c) => statusOf(c) === "pending");

  function save(ids: string[]) {
    setBusy((b) => [...b, ...ids]);
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !ids.includes(k))));
    startTransition(async () => {
      const res = await saveChangesAction(ids);
      setBusy((b) => b.filter((id) => !ids.includes(id)));
      if (!res?.ok) {
        const message = res?.error.message ?? "Could not save. Try again.";
        setErrors((e) => ({ ...e, ...Object.fromEntries(ids.map((id) => [id, message])) }));
        return;
      }
      for (const r of res.data ?? []) {
        if (r.ok) setStatus((s) => ({ ...s, [r.id]: "saved" }));
        else setErrors((e) => ({ ...e, [r.id]: r.message ?? "Could not save." }));
      }
    });
  }

  function skip(id: string) {
    setBusy((b) => [...b, id]);
    startTransition(async () => {
      const res = await skipChangeAction(id);
      setBusy((b) => b.filter((x) => x !== id));
      if (res?.ok) setStatus((s) => ({ ...s, [id]: "skipped" }));
      else setErrors((e) => ({ ...e, [id]: res?.error.message ?? "Could not skip. Try again." }));
    });
  }

  return (
    <section aria-label="Suggested changes" className="rise-1 mt-4 rounded-[1.1rem] border border-line bg-night-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label">{lost ? "not kept · ask again to get these back" : pending.length ? "suggested · nothing is saved until you tap save" : "suggested changes"}</p>
        {ready && pending.length > 1 && (
          <button type="button" className={saveAllBtn} disabled={busy.length > 0} onClick={() => save(pending.map((c) => c.id))}>
            Save all {pending.length}
          </button>
        )}
      </div>
      <ul className="mt-2 flex flex-col">
        {changes.map((c) => {
          const s = statusOf(c);
          const working = busy.includes(c.id);
          return (
            <li key={c.id} className={`drop-in flex flex-col gap-2 border-t border-line py-3 first:border-0 ${s === "skipped" ? "opacity-50" : ""}`}>
              <Row change={c} currency={currency} today={today} />
              {c.warning && s === "pending" && <p className="text-[.85rem] text-accent">{c.warning}</p>}
              {errors[c.id] && <p className="text-[.85rem] text-accent">{errors[c.id]}</p>}
              <div className="flex items-center justify-end gap-2">
                {s === "pending" ? (
                  ready && !lost ? (
                    <>
                      <button type="button" className={btn} disabled={working} onClick={() => skip(c.id)}>
                        skip
                      </button>
                      <button type="button" className={btn} disabled={working} onClick={() => save([c.id])}>
                        {working ? "saving…" : c.kind.startsWith("delete") ? "delete" : "save"}
                      </button>
                    </>
                  ) : null
                ) : (
                  <span className={badge}>{s}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({ change, currency, today }: { change: ChangeView; currency: string; today: string }) {
  const now = (change.after ?? change.before)!;
  const was = change.after && change.before ? change.before : null;
  return (
    <div className="flex items-start gap-3">
      <span className={`${badge} mt-0.5`}>{verbs[change.kind]}</span>
      {"description" in now ? <TxLine tx={now} was={was as TxView | null} currency={currency} today={today} gone={!change.after} /> : <AccountLine a={now} was={was as AccountView | null} currency={currency} gone={!change.after} />}
    </div>
  );
}

function TxLine({ tx, was, currency, today, gone }: { tx: TxView; was: TxView | null; currency: string; today: string; gone: boolean }) {
  const n = toNumber(tx.amount);
  const diff: string[] = [];
  if (was) {
    if (was.description !== tx.description) diff.push(was.description);
    if (was.amount !== tx.amount) diff.push(formatMoney(toNumber(was.amount), currency, { sign: toNumber(was.amount) > 0 }));
    if (was.date !== tx.date) diff.push(dayLabel(was.date, today));
    if (was.account !== tx.account) diff.push(was.account);
    if (was.category !== tx.category) diff.push(was.category ?? "no category");
    if (was.note !== tx.note) diff.push(was.note ? `note “${was.note}”` : "no note");
  }
  return (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`truncate font-semibold ${gone ? "line-through decoration-ash" : ""}`}>{tx.description}</p>
        <p className="label mt-0.5">
          {[dayLabel(tx.date, today), tx.account, tx.transfer ? "transfer" : (tx.category ?? "no category")].join(" · ")}
        </p>
        {tx.note && <p className="mt-0.5 truncate text-[.85rem] text-ink-soft">{tx.note}</p>}
        {diff.length > 0 && <p className="mt-0.5 text-[.85rem] text-ink-soft">was {diff.join(" · ")}</p>}
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${n > 0 ? "text-steel" : ""}`}>{formatMoney(n, currency, { sign: n > 0 })}</span>
    </div>
  );
}

function opening(a: AccountView, currency: string) {
  const n = toNumber(a.openingBalance);
  return isOwed(a.kind) ? `started owing ${formatMoney(Math.abs(n), currency)}` : `started at ${formatMoney(n, currency)}`;
}

function AccountLine({ a, was, currency, gone }: { a: AccountView; was: AccountView | null; currency: string; gone: boolean }) {
  const diff: string[] = [];
  if (was) {
    if (was.name !== a.name) diff.push(was.name);
    if (was.kind !== a.kind) diff.push(kindLabels[was.kind]);
    if (was.openingBalance !== a.openingBalance) diff.push(opening(was, currency));
  }
  return (
    <div className="min-w-0 flex-1">
      <p className={`truncate font-semibold ${gone ? "line-through decoration-ash" : ""}`}>{a.name}</p>
      <p className="label mt-0.5">
        {[kindLabels[a.kind], opening(a, currency), a.transactions != null ? `${a.transactions} transactions` : null].filter(Boolean).join(" · ")}
      </p>
      {diff.length > 0 && <p className="mt-0.5 text-[.85rem] text-ink-soft">was {diff.join(" · ")}</p>}
    </div>
  );
}
