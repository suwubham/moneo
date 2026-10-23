"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { monthLabel } from "@/lib/core/dates";
import { formatMoney } from "@/lib/core/money";
import type { BudgetSuggestion } from "@/lib/modules/ai/budget-suggest";
import type { BudgetKind } from "@/lib/modules/budgets/schema";
import { BudgetMonths } from "../../_components/budget-months";
import { BudgetHistory, type HistoryPoint } from "../../_components/charts";
import { Drawer, DrawerButton } from "../../_components/drawer";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, btnSoft, input } from "../../_components/styles";
import { acceptSuggestionAction, deleteBudgetAction, saveBudgetAction, suggestBudgetsAction } from "./actions";

type Option = { id: string; name: string };
export type BudgetValues = { id: string; kind: BudgetKind; name: string; amount: string };

const kindLabels: Record<BudgetKind, string> = {
  category: "One category",
  total: "All spending",
  picked: "Only transactions I add",
};
const kindHints: Record<BudgetKind, string> = {
  category: "Counts money out in one spending category.",
  total: "Counts all money out, across every category and account.",
  picked: "Counts only the transactions you add to it, like a trip or a project. Pick it on a transaction.",
};

function BudgetForm({
  categories,
  canTotal,
  initial,
  month,
  history,
  txHref,
  currency,
  onDone,
}: {
  categories: Option[];
  canTotal: boolean;
  initial?: BudgetValues;
  month?: string;
  history?: HistoryPoint[];
  txHref?: string;
  currency?: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveBudgetAction, null);
  const [del, setDel] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const kinds = (["category", "total", "picked"] as const).filter((k) => (k === "category" ? categories.length > 0 : k === "total" ? canTotal : true));
  const [kind, setKind] = useState<BudgetKind>(initial?.kind ?? kinds[0]);

  useEffect(() => {
    if (state?.ok || del?.ok) onDone();
  }, [state, del, onDone]);

  return (
    <form action={action} className="flex flex-col gap-5">
      {initial && history && currency && (
        <section aria-label="Every month" className="rounded-[1.1rem] border border-line bg-night p-4">
          <p className="label mb-2">
            {history.length} month{history.length === 1 ? "" : "s"} · since {monthLabel(history[0].key).toLowerCase()}
          </p>
          <BudgetHistory data={history} currency={currency} />
          <div className="mt-3 border-t border-line pt-2">
            <BudgetMonths
              history={history}
              currency={currency}
              href={(m) => (txHref ?? `/transactions?budget=${initial.id}&month=${month}`).replace(/month=[^&]+/, `month=${m}`)}
            />
          </div>
        </section>
      )}
      {initial ? (
        <>
          <input type="hidden" name="id" value={initial.id} />
          {initial.kind !== "picked" && <p className="text-[1.1rem] font-semibold">{initial.name}</p>}
        </>
      ) : (
        <Field label="what it counts" name="kind" state={state} hint={kindHints[kind]}>
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as BudgetKind)} className={input}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {kindLabels[k]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!initial && kind === "category" && (
        <Field label="category" name="categoryId" state={state}>
          <select id="categoryId" name="categoryId" required defaultValue="" className={input}>
            <option value="" disabled>
              Pick a spending category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {kind === "picked" && (
        <Field label="name" name="name" state={state}>
          <input id="name" name="name" required maxLength={60} defaultValue={initial?.name} placeholder="Trip to Pokhara" className={input} autoComplete="off" />
        </Field>
      )}
      <Field label="monthly limit" name="amount" state={state} hint={initial ? "a new limit counts from this month on. past months keep the limit they had." : undefined}>
        <input id="amount" name="amount" required inputMode="decimal" defaultValue={initial?.amount} placeholder="0.00" className={`${input} tabular-nums`} />
      </Field>
      {initial && (txHref || initial.kind === "picked") && (
        <Link href={txHref ?? `/transactions?budget=${initial.id}${month ? `&month=${month}` : ""}`} className="label underline">
          see its transactions →
        </Link>
      )}
      <FormError state={state} />
      <FormError state={del} />
      <div className="flex flex-wrap gap-2.5">
        <Submit className={btnPrimary}>{initial ? "Save limit" : "Add budget"}</Submit>
        {initial && (
          <button type="button" disabled={busy} className={btnDanger} onClick={() => start(async () => setDel(await deleteBudgetAction(initial.id)))}>
            remove budget
          </button>
        )}
      </div>
    </form>
  );
}

export function NewBudgetButton({ categories, canTotal, className }: { categories: Option[]; canTotal: boolean; className: string }) {
  return (
    <DrawerButton label="Add budget" title="New budget" className={className}>
      {(close) => <BudgetForm categories={categories} canTotal={canTotal} onDone={close} />}
    </DrawerButton>
  );
}

export function EditBudget({
  budget,
  month,
  history,
  txHref,
  currency,
  className,
  children,
}: {
  budget: BudgetValues;
  month: string;
  history: HistoryPoint[];
  txHref: string;
  currency: string;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <Drawer open={open} onClose={close} title={budget.name}>
        <BudgetForm categories={[]} canTotal={false} initial={budget} month={month} history={history} txHref={txHref} currency={currency} onDone={close} />
      </Drawer>
    </>
  );
}

export function Suggestions({ currency }: { currency: string }) {
  const [state, setState] = useState<ActionState<BudgetSuggestion[]>>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const list = state?.ok ? (state.data ?? []) : [];

  return (
    <div>
      <button type="button" className={btnSoft} disabled={busy} onClick={() => start(async () => setState(await suggestBudgetsAction()))}>
        {busy ? "looking at the last 3 months…" : state ? "Suggest again" : "Suggest budgets from my spending"}
      </button>
      {state && !state.ok && <p className="mt-3 text-[.9rem] text-accent">{state.error.message}</p>}
      {state?.ok && list.length === 0 && (
        <p className="label mt-3">Nothing to suggest yet. It needs a few months of spending in categories without a budget.</p>
      )}
      {list.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {list.map((s) => (
            <li key={s.categoryId} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-line bg-night px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {s.name} · <span className="tabular-nums">{formatMoney(s.amount, currency)}</span>
                </p>
                <p className="label">
                  avg {formatMoney(s.average, currency)} · {s.reason}
                </p>
              </div>
              <AcceptButton s={s} done={added.has(s.categoryId)} onDone={() => setAdded((a) => new Set(a).add(s.categoryId))} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AcceptButton({ s, done, onDone }: { s: BudgetSuggestion; done: boolean; onDone: () => void }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string>();
  if (done) return <span className="label text-steel">added</span>;
  return (
    <span className="flex items-center gap-2">
      {err && <span className="text-[.8rem] text-accent">{err}</span>}
      <button
        type="button"
        className={btn}
        disabled={busy}
        onClick={() =>
          start(async () => {
            const res = await acceptSuggestionAction(s.categoryId, s.amount);
            if (res?.ok) onDone();
            else if (res) setErr(res.error.message);
          })
        }
      >
        {busy ? "adding…" : "add"}
      </button>
    </span>
  );
}
