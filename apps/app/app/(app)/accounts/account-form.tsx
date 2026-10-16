"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { type AccountKind, accountIcons, accountKinds, accountLook, kindLabels } from "@/lib/modules/accounts/constants";
import { categoryColors } from "@/lib/modules/categories/look";
import { AccountIcon, accountIconSet } from "../../_components/account-icon";
import { colorVar } from "../../_components/category-icon";
import { Field, FormError, Submit } from "../../_components/form";
import { btn, btnDanger, btnPrimary, input } from "../../_components/styles";
import { archiveAccountAction, deleteAccountAction, saveAccountAction } from "./actions";

export type AccountValues = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: string;
  archived: boolean;
  icon?: string | null;
  color?: string | null;
};

const pick = "grid size-11 place-items-center rounded-full border transition-colors duration-200 ease-soft";

export function AccountForm({ account, onDone }: { account?: AccountValues; onDone: () => void }) {
  const [state, action] = useActionState(saveAccountAction, null);
  const [other, setOther] = useState<ActionState>(null);
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "checking");
  // Null follows the kind's default until the person picks something.
  const [icon, setIcon] = useState<string | null>(account?.icon ?? null);
  const [color, setColor] = useState<string | null>(account?.color ?? null);
  const look = accountLook({ kind, icon, color }, categoryColors);

  useEffect(() => {
    if (state?.ok || other?.ok) onDone();
  }, [state, other, onDone]);

  const run = (fn: () => Promise<ActionState>) => start(async () => setOther(await fn()));

  return (
    <form action={action} className="flex flex-col gap-5">
      {account && <input type="hidden" name="id" value={account.id} />}
      <input type="hidden" name="icon" value={icon ?? ""} />
      <input type="hidden" name="color" value={color ?? ""} />
      <div className="flex items-center gap-3">
        <AccountIcon kind={kind} icon={icon} color={color} size="lg" />
        <p className="label">how it shows up across Moneo</p>
      </div>
      <Field label="name" name="name" state={state}>
        <input id="name" name="name" required maxLength={60} defaultValue={account?.name} placeholder="Everyday card" className={input} autoComplete="off" />
      </Field>
      <Field label="type" name="kind" state={state}>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)} className={input}>
          {accountKinds.map((k) => (
            <option key={k} value={k}>
              {kindLabels[k]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className="label mb-2">colour</legend>
        <div className="flex flex-wrap gap-2">
          {categoryColors.map((c) => (
            <label key={c} className={`${pick} cursor-pointer ${c === look.color ? "border-ink" : "border-transparent"}`}>
              <input type="radio" name="color-pick" value={c} checked={c === look.color} onChange={() => setColor(c)} className="sr-only" />
              <span className="sr-only">{c}</span>
              <span aria-hidden className="size-6 rounded-full" style={{ background: colorVar(c) }} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label mb-2">icon</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {accountIcons.map((k) => {
            const Icon = accountIconSet[k];
            const on = k === look.icon;
            const c = colorVar(look.color as (typeof categoryColors)[number]);
            return (
              <label
                key={k}
                className={`${pick} cursor-pointer ${on ? "border-transparent" : "border-line text-ink-soft hover:text-ink"}`}
                style={on ? { background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c } : undefined}
              >
                <input type="radio" name="icon-pick" value={k} checked={on} onChange={() => setIcon(k)} className="sr-only" />
                <span className="sr-only">{k}</span>
                <Icon aria-hidden className="size-[1.15rem]" strokeWidth={1.9} />
              </label>
            );
          })}
        </div>
      </fieldset>
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
