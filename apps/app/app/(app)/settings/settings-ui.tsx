"use client";

import { useClerk } from "@clerk/nextjs";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { currencies } from "@/lib/core/money";
import { Field, FormError, Submit } from "../../_components/form";
import { btnDanger, btnSoft, control } from "../../_components/styles";
import { addCategoryAction, currencyAction, deleteCategoryAction, deleteEverythingAction } from "./actions";

export function CurrencyForm({ currency }: { currency: string }) {
  const [state, action] = useActionState(currencyAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="currency" name="currency" state={state}>
        <select id="currency" name="currency" defaultValue={currency} className={`${control} w-40`}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Submit className={btnSoft}>Save</Submit>
      {state?.ok && <span className="label pb-2 text-steel">{state.message}</span>}
      <FormError state={state} />
    </form>
  );
}

export function AddCategory() {
  const [state, action] = useActionState(addCategoryAction, null);
  return (
    <form key={state?.ok ? state.at : 0} action={action} className="flex flex-wrap items-end gap-3">
      <Field label="new category" name="name" state={state}>
        <input id="name" name="name" required maxLength={40} placeholder="Pets" className={`${control} w-48`} autoComplete="off" />
      </Field>
      <Field label="type" name="kind" state={state}>
        <select id="kind" name="kind" defaultValue="expense" className={`${control} w-36`}>
          <option value="expense">spending</option>
          <option value="income">income</option>
        </select>
      </Field>
      <Submit className={btnSoft}>Add</Submit>
      <FormError state={state} />
    </form>
  );
}

export function RemoveCategory({ id, name }: { id: string; name: string }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string>();
  return (
    <button
      type="button"
      disabled={busy}
      title={err}
      aria-label={`Remove ${name}`}
      onClick={() =>
        start(async () => {
          const res = await deleteCategoryAction(id);
          if (res && !res.ok) setErr(res.error.message);
        })
      }
      className="grid size-6 place-items-center rounded-full text-ink-soft transition-colors duration-200 ease-soft hover:text-accent"
    >
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

export function DeleteEverything({ siteUrl }: { siteUrl: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteEverythingAction, null);
  const { signOut } = useClerk();
  useEffect(() => {
    if (state?.ok) void signOut({ redirectUrl: siteUrl });
  }, [state, signOut, siteUrl]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label='type "delete" to confirm' name="confirm" state={state}>
        <input id="confirm" name="confirm" autoComplete="off" className={`${control} w-48`} />
      </Field>
      <Submit className={`${btnDanger} h-11`} pending="deleting…">
        delete my account and data
      </Submit>
      <FormError state={state} />
    </form>
  );
}
