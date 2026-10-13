"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { accountKinds, kindLabels } from "@/lib/modules/accounts/constants";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, input } from "../../_components/styles";
import { archiveAccountAction, deleteAccountAction, saveAccountAction } from "./actions";

export type AccountValues = { id: string; name: string; kind: (typeof accountKinds)[number]; openingBalance: string; archived: boolean };

export function AccountForm({ account, onDone }: { account?: AccountValues; onDone: () => void }) {
  const [state, action] = useActionState(saveAccountAction, null);
  const [other, setOther] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state?.ok || other?.ok) onDone();
  }, [state, other, onDone]);

  const run = (fn: () => Promise<ActionState>) => start(async () => setOther(await fn()));

  return (
    <form action={action} className="flex flex-col gap-5">
      {account && <input type="hidden" name="id" value={account.id} />}
      <Field label="name" name="name" state={state}>
        <input id="name" name="name" required maxLength={60} defaultValue={account?.name} placeholder="Everyday card" className={input} autoComplete="off" />
      </Field>
      <Field label="type" name="kind" state={state}>
        <select id="kind" name="kind" defaultValue={account?.kind ?? "checking"} className={input}>
          {accountKinds.map((k) => (
            <option key={k} value={k}>
              {kindLabels[k]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="starting balance" name="openingBalance" state={state} hint="what it held before the first transaction you add. negative for money owed.">
        <input
          id="openingBalance"
          name="openingBalance"
          inputMode="decimal"
          defaultValue={account?.openingBalance ?? ""}
          placeholder="0.00"
          className={`${input} tabular-nums`}
        />
      </Field>
      <FormError state={state} />
      <FormError state={other} />
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Submit className={btnPrimary}>{account ? "Save changes" : "Add account"}</Submit>
        {account && (
          <>
            <button type="button" disabled={busy} className={btn} onClick={() => run(() => archiveAccountAction(account.id, !account.archived))}>
              {account.archived ? "unarchive" : "archive"}
            </button>
            {confirming ? (
              <button type="button" disabled={busy} className={btnDanger} onClick={() => run(() => deleteAccountAction(account.id))}>
                delete it and its transactions
              </button>
            ) : (
              <button type="button" className={btn} onClick={() => setConfirming(true)}>
                delete…
              </button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
