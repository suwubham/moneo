"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, control, input, textarea } from "../../_components/styles";
import { deleteTransactionAction, saveTransactionAction } from "./actions";

export type Option = { id: string; name: string };
export type CategoryOption = Option & { kind: "expense" | "income" };

export type TxValues = {
  id?: string;
  direction: "out" | "in";
  amount: string;
  description: string;
  occurredOn: string;
  accountId: string | null;
  categoryId: string | null;
  note: string | null;
};

const seg = "flex-1 rounded-full px-4 py-2 text-center font-mono text-[.8rem] transition-colors duration-300 ease-soft";

export function TransactionForm({
  values,
  accounts,
  categories,
  onDone,
}: {
  values: TxValues;
  accounts: Option[];
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveTransactionAction, null);
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
    <form action={action} className="flex flex-col gap-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <fieldset className="flex gap-1 rounded-full border border-line bg-night p-1">
        <legend className="sr-only">Direction</legend>
        {(["out", "in"] as const).map((d) => (
          <label key={d} className={`${seg} cursor-pointer ${direction === d ? "bg-night-3 text-ink" : "text-ink-soft"}`}>
            <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
            {d === "out" ? "money out" : "money in"}
          </label>
        ))}
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
      <Field label="category" name="categoryId" state={state}>
        <select
          id="categoryId"
          name="categoryId"
          key={kind}
          defaultValue={shown.some((c) => c.id === values.categoryId) ? (values.categoryId ?? "") : ""}
          className={input}
        >
          <option value="">Uncategorised</option>
          {shown.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="note" name="note" state={state}>
        <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={values.note ?? ""} className={textarea} />
      </Field>
      <FormError state={state} />
      <FormError state={del} />
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Submit className={btnPrimary}>{values.id ? "Save changes" : "Add transaction"}</Submit>
        {values.id &&
          (confirming ? (
            <button type="button" disabled={busy} className={btnDanger} onClick={() => start(async () => setDel(await deleteTransactionAction(values.id!)))}>
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
