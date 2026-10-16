"use client";

import { useOffline } from "next/offline";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { enqueue } from "@/lib/offline/sync";
import { readOfflineForm } from "@/lib/offline/validate";
import { CategoryIcon } from "../../_components/category-icon";
import { Segmented, segItem } from "../../_components/segmented";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, control, input, textarea } from "../../_components/styles";
import { deleteTransactionAction, saveTransactionAction } from "./actions";

export type Option = { id: string; name: string };
export type CategoryOption = Option & { kind: "expense" | "income"; icon?: string | null; color?: string | null };

export type TxValues = {
  id?: string;
  direction: "out" | "in";
  amount: string;
  description: string;
  occurredOn: string;
  accountId: string | null;
  categoryId: string | null;
  note: string | null;
  budgetId?: string | null;
  excludeFromBudgets?: boolean;
};


export function TransactionForm({
  values,
  accounts,
  categories,
  budgets,
  queue = false,
  onDone,
}: {
  values: TxValues;
  accounts: Option[];
  categories: CategoryOption[];
  budgets: Option[];
  // Always save to the device outbox (the offline page has no server to talk to).
  queue?: boolean;
  onDone: () => void;
}) {
  const [saved, action] = useActionState(saveTransactionAction, null);
  const [local, setLocal] = useState<ActionState>(null);
  const state = local ?? saved;
  const offline = useOffline();
  const toOutbox = () => queue || offline || !navigator.onLine;
  const [del, setDel] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const [direction, setDirection] = useState(values.direction);
  const [confirming, setConfirming] = useState(false);
  const kind = direction === "out" ? "expense" : "income";
  const shown = categories.filter((c) => c.kind === kind);

  useEffect(() => {
    if (state?.ok || del?.ok) onDone();
  }, [state, del, onDone]);

  return (
    <form
      action={(form) => {
        if (!toOutbox()) return action(form);
        // No connection: check it here, keep it on the device, and let sync send it later.
        const read = readOfflineForm(form);
        if (!read.ok) {
          setLocal({ ok: false, error: { code: "validation_error", message: "Some fields need another look.", details: { issues: read.issues } }, at: Date.now() });
          return;
        }
        setLocal(null);
        void enqueue({ kind: values.id ? "update" : "create", id: values.id, input: read.input }).then(onDone);
      }}
      className="flex flex-col gap-5"
    >
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <fieldset>
        <legend className="sr-only">Direction</legend>
        <Segmented count={2} index={direction === "out" ? 0 : 1} className="bg-night">
          {(["out", "in"] as const).map((d) => (
            <label key={d} className={`${segItem(direction === d)} cursor-pointer py-2`}>
              <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
              {d === "out" ? "money out" : "money in"}
            </label>
          ))}
        </Segmented>
      </fieldset>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="what was it" name="description" state={state}>
          <input id="description" name="description" required maxLength={140} defaultValue={values.description} placeholder="Corner café" className={input} autoComplete="off" />
        </Field>
        <Field label="amount" name="amount" state={state}>
          <input
            id="amount"
            name="amount"
            required
            inputMode="decimal"
            defaultValue={values.amount}
            placeholder="0.00"
            className={`${control} w-32 text-right tabular-nums`}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="date" name="occurredOn" state={state}>
          <input id="occurredOn" name="occurredOn" type="date" required defaultValue={values.occurredOn} className={input} />
        </Field>
        <Field label="account" name="accountId" state={state}>
          <select id="accountId" name="accountId" required defaultValue={values.accountId ?? ""} className={input}>
            <option value="" disabled>
              Pick one
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset key={kind}>
        <legend className="label mb-2">category</legend>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {[null, ...shown].map((c) => (
            <label
              key={c?.id ?? "none"}
              className="chip-pick flex cursor-pointer items-center gap-2 rounded-full border border-line bg-night py-1 pr-3 pl-1 text-[.88rem] text-ink-soft transition-colors duration-200 ease-soft hover:border-steel has-checked:border-ink has-checked:text-ink"
            >
              <input
                type="radio"
                name="categoryId"
                value={c?.id ?? ""}
                defaultChecked={c ? c.id === values.categoryId : !shown.some((x) => x.id === values.categoryId)}
                className="sr-only"
              />
              <CategoryIcon category={c} size="sm" />
              {c?.name ?? "None"}
            </label>
          ))}
        </div>
      </fieldset>
      {budgets.length > 0 ? (
        <Field label="budget" name="budgetId" state={state} hint="Only for budgets that count the transactions you add.">
          <select id="budgetId" name="budgetId" defaultValue={values.budgetId ?? ""} className={input}>
            <option value="">None</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        values.budgetId && <input type="hidden" name="budgetId" value={values.budgetId} />
      )}
      <label className="flex cursor-pointer items-center gap-2.5 text-[.95rem] text-ink-soft">
        <input type="checkbox" name="excludeFromBudgets" defaultChecked={values.excludeFromBudgets} className="size-4 accent-steel" />
        Leave out of category and total budgets (for example, a transfer between your accounts)
      </label>
      <Field label="note" name="note" state={state}>
        <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={values.note ?? ""} className={textarea} />
      </Field>
      <FormError state={state} />
      <FormError state={del} />
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Submit className={btnPrimary}>{values.id ? "Save changes" : "Add transaction"}</Submit>
        {values.id &&
          (confirming ? (
            <button type="button" disabled={busy} className={btnDanger} onClick={() =>
                start(async () => {
                  if (toOutbox()) {
                    await enqueue({ kind: "delete", id: values.id!, label: values.description });
                    onDone();
                  } else setDel(await deleteTransactionAction(values.id!));
                })
              }>
              yes, delete it
            </button>
          ) : (
            <button type="button" className={btn} onClick={() => setConfirming(true)}>
              delete…
            </button>
          ))}
      </div>
    </form>
  );
}
