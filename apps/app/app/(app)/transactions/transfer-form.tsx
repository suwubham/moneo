"use client";

import { useOffline } from "next/offline";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { formatMoney, plainAmount, toNumber } from "@/lib/core/money";
import { type AccountKind, isOwed } from "@/lib/modules/accounts/constants";
import { Field, FormError, Submit } from "../../_components/form";
import { Segmented, segItem } from "../../_components/segmented";
import { btn, btnDanger, btnPrimary, control, input, textarea } from "../../_components/styles";
import { deleteTransferAction, saveTransferAction } from "./actions";
import type { Option } from "./transaction-form";

// Kind and balance let a card payment offer to clear what the card owes.
export type AccountOption = Option & { kind?: AccountKind; balance?: string };

export type TransferValues = {
  // The transfer's id, shared by its two rows.
  id?: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  amount: string;
  occurredOn: string;
  description: string;
  note: string | null;
};

// Both rows of a transfer change together on the server, so it needs a connection; the outbox only holds single rows.
const needsConnection = (): ActionState => ({
  ok: false,
  error: { code: "offline", message: "Transfers need a connection. Try again when you are back online." },
  at: Date.now(),
});

export function TransferForm({
  values,
  accounts,
  currency,
  onSwitch,
  onDone,
}: {
  values: TransferValues;
  accounts: AccountOption[];
  currency?: string;
  // For a new transfer: go back to a plain money out or money in.
  onSwitch?: (direction: "out" | "in") => void;
  onDone: () => void;
}) {
  const [saved, action] = useActionState(saveTransferAction, null);
  const [local, setLocal] = useState<ActionState>(null);
  const state = local ?? saved;
  const offline = useOffline();
  const [del, setDel] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [to, setTo] = useState(values.toAccountId);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  // Paying a card or loan: offer the whole amount it owes. Only for a new transfer; an old one is already in the balance.
  const target = accounts.find((a) => a.id === to);
  const owes = !values.id && target?.kind && isOwed(target.kind) && toNumber(target.balance) < 0 ? -toNumber(target.balance) : 0;

  useEffect(() => {
    if (state?.ok || del?.ok) onDone();
  }, [state, del, onDone]);

  const isOffline = () => offline || !navigator.onLine;
  const pick = (name: "fromAccountId" | "toAccountId", label: string, value: string | null) => (
    <Field label={label} name={name} state={state}>
      <select
        id={name}
        name={name}
        required
        defaultValue={value ?? ""}
        onChange={name === "toAccountId" ? (e) => setTo(e.target.value) : undefined}
        className={input}
      >
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
  );

  return (
    <form
      action={(form) => {
        if (isOffline()) return setLocal(needsConnection());
        setLocal(null);
        return action(form);
      }}
      className="flex flex-col gap-5"
    >
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {onSwitch && (
        <Segmented count={3} index={2} className="bg-night">
          {(["out", "in"] as const).map((d) => (
            <button key={d} type="button" onClick={() => onSwitch(d)} className={`${segItem(false)} py-2`}>
              {d === "out" ? "money out" : "money in"}
            </button>
          ))}
          <span aria-current="true" className={`${segItem(true)} py-2`}>
            move money
          </span>
        </Segmented>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {pick("fromAccountId", "from", values.fromAccountId)}
        {pick("toAccountId", "to", values.toAccountId)}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="what was it" name="description" state={state}>
          <input
            ref={descriptionRef}
            id="description"
            name="description"
            required
            maxLength={140}
            defaultValue={values.description}
            className={input}
            autoComplete="off"
          />
        </Field>
        <Field label="amount" name="amount" state={state}>
          <input
            ref={amountRef}
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
      {owes > 0 && target && (
        <button
          type="button"
          className={`${btn} self-start`}
          onClick={() => {
            if (amountRef.current) amountRef.current.value = plainAmount(owes);
            const d = descriptionRef.current;
            if (d && (d.value === "" || d.value === "Transfer")) d.value = `${target.name} payment`;
          }}
        >
          pay all it owes{currency ? ` · ${formatMoney(owes, currency)}` : ""}
        </button>
      )}
      <Field label="date" name="occurredOn" state={state}>
        <input id="occurredOn" name="occurredOn" type="date" required defaultValue={values.occurredOn} className={input} />
      </Field>
      <Field label="note" name="note" state={state}>
        <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={values.note ?? ""} className={textarea} />
      </Field>
      <p className="text-[.88rem] text-ink-soft">
        A transfer moves money between your own accounts, like paying off a card from your bank. It is not spending or income, so budgets and reports leave
        it out.
      </p>
      <FormError state={state} />
      <FormError state={del} />
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Submit className={btnPrimary}>{values.id ? "Save changes" : "Move money"}</Submit>
        {values.id &&
          (confirming ? (
            <button
              type="button"
              disabled={busy}
              className={btnDanger}
              onClick={() =>
                start(async () => {
                  if (isOffline()) setDel(needsConnection());
                  else setDel(await deleteTransferAction(values.id!));
                })
              }
            >
              yes, delete both sides
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
