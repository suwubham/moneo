"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { formatMoney } from "@/lib/core/money";
import type { BudgetSuggestion } from "@/lib/modules/ai/budget-suggest";
import { Drawer, DrawerButton } from "../../_components/drawer";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, btnSoft, input } from "../../_components/styles";
import { acceptSuggestionAction, deleteBudgetAction, saveBudgetAction, suggestBudgetsAction } from "./actions";

type Option = { id: string; name: string };

function BudgetForm({
  categories,
  initial,
  onDone,
}: {
  categories: Option[];
  initial?: { id: string; categoryId: string; amount: string };
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveBudgetAction, null);
  const [del, setDel] = useState<ActionState>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (state?.ok || del?.ok) onDone();
  }, [state, del, onDone]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="category" name="categoryId" state={state}>
        {initial ? (
          <>
            <input type="hidden" name="categoryId" value={initial.categoryId} />
            <p className="text-[1.1rem] font-semibold">{categories.find((c) => c.id === initial.categoryId)?.name}</p>
          </>
        ) : (
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
        )}
      </Field>
      <Field label="monthly limit" name="amount" state={state}>
        <input id="amount" name="amount" required inputMode="decimal" defaultValue={initial?.amount} placeholder="0.00" className={`${input} tabular-nums`} />
      </Field>
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

export function NewBudgetButton({ categories, className }: { categories: Option[]; className: string }) {
  return (
    <DrawerButton label="Add budget" title="New budget" className={className}>
      {(close) => <BudgetForm categories={categories} onDone={close} />}
    </DrawerButton>
  );
}

export function EditBudget({
  budget,
  categories,
  className,
  children,
}: {
  budget: { id: string; categoryId: string; amount: string };
  categories: Option[];
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
      <Drawer open={open} onClose={close} title="Edit budget">
        <BudgetForm categories={categories} initial={budget} onDone={close} />
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
