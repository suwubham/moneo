"use client";

import { Check, Copy, Plus } from "lucide-react";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { dayLabel, todayIso } from "@/lib/core/dates";
import { Drawer } from "../../_components/drawer";
import { Field, FormError, Submit } from "../../_components/form";
import { Money } from "../../_components/money";
import { badge, btn, btnPrimary, btnSoft, input, textarea } from "../../_components/styles";
import { addFromEmailAction, deleteHintAction, dismissEmailAction, newAddressAction, saveHintAction } from "./actions";

type Option = { id: string; name: string };
type Hint = { id: string; subject: string; hint: string };
type Email = {
  id: string;
  status: "added" | "review" | "unread" | "code" | "dismissed";
  amount: string | null;
  currency: string | null;
  occurredOn: string | null;
  merchant: string | null;
  description: string | null;
  accountId: string | null;
  categoryId: string | null;
  code: string | null;
  senderDomain: string | null;
};

export function Address({ address }: { address: string | null }) {
  const [state, setState] = useState<ActionState<string>>(null);
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const make = () => start(async () => setState(await newAddressAction()));

  if (!address) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnSoft} disabled={busy} onClick={make}>
          {busy ? "Making…" : "Get my address"}
        </button>
        <FormError state={state} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 rounded-lg border border-line bg-night px-3.5 py-2.5 font-mono text-[.88rem] break-all">{address}</code>
        <button
          type="button"
          className={btn}
          onClick={() => {
            void navigator.clipboard.writeText(address).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "copied" : "copy"}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => {
            if (confirm("Make a new address? Mail sent to this one will be ignored, so update your Gmail forward too.")) make();
          }}
        >
          new address
        </button>
      </div>
      <FormError state={state} />
    </div>
  );
}

// Gmail now sends a link to confirm a new forwarding address; older emails carried a code to paste back.
export function ForwardCode({ code }: { code: string }) {
  if (code.startsWith("https://mail.google.com/mail/vf-")) {
    return (
      <div role="status" className="flex flex-col items-start gap-2 rounded-lg border border-line bg-night px-3.5 py-3 text-[.92rem]">
        <span>Gmail wants to check this address before it forwards anything.</span>
        <a href={code} target="_blank" rel="noreferrer" className={btnSoft}>
          Confirm forwarding in Gmail
        </a>
        <span className="text-ink-soft">Open it while signed in to the Gmail account that forwards here.</span>
      </div>
    );
  }
  return (
    <p role="status" className="rounded-lg border border-line bg-night px-3.5 py-2.5 text-[.92rem]">
      Gmail&apos;s confirmation code: <code className="font-mono font-bold tracking-wide">{code}</code>
      <span className="block text-ink-soft">Paste it in Gmail under Settings → Forwarding to finish.</span>
    </p>
  );
}

// Emails the AI read but could not save alone: no clear account, another currency, or an amount it was unsure of.
export function ToCheck({ emails, accounts, categories }: { emails: Email[]; accounts: Option[]; categories: Option[] }) {
  if (emails.length === 0) return null;
  return (
    <>
      <h3 className="label mt-6 mb-1">needs you</h3>
      <p className="mb-3 text-[.9rem] text-ink-soft">The AI was not sure about these. Fix what is wrong and add them. A hint helps it next time.</p>
      <ul className="flex flex-col gap-3">
        {emails.map((e) => (
          <li key={e.id}>
            <ReviewEmail email={e} accounts={accounts} categories={categories} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ReviewEmail({ email, accounts, categories }: { email: Email; accounts: Option[]; categories: Option[] }) {
  const [state, action] = useActionState(addFromEmailAction, null);
  const [busy, start] = useTransition();
  const f = (name: string) => `${name}-${email.id}`;
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-line bg-night p-3.5">
      <input type="hidden" name="id" value={email.id} />
      <EmailLine email={email} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="call it" name={f("description")} state={state}>
          <input id={f("description")} name="description" required maxLength={140} defaultValue={email.description ?? email.merchant ?? ""} className={input} autoComplete="off" />
        </Field>
        <Field label="account" name={f("account")} state={state}>
          <select id={f("account")} name="accountId" required defaultValue={email.accountId ?? ""} className={input}>
            <option value="" disabled>
              pick one
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="category" name={f("category")} state={state}>
          <select id={f("category")} name="categoryId" defaultValue={email.categoryId ?? ""} className={input}>
            <option value="">none</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Submit className={btnSoft} pending="adding…">
          Add
        </Submit>
        <button type="button" className={btn} disabled={busy} onClick={() => start(async () => void (await dismissEmailAction(email.id)))}>
          dismiss
        </button>
      </div>
      <FormError state={state} />
    </form>
  );
}

function EmailLine({ email }: { email: Email }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[.95rem]">
      {email.amount && email.currency && <Money value={email.amount} currency={email.currency} className="font-bold" />}
      <span>{email.merchant}</span>
      {email.occurredOn && <span className="label">{dayLabel(email.occurredOn, todayIso())}</span>}
    </p>
  );
}

const statusText: Record<Email["status"], string> = {
  added: "added",
  review: "needs you",
  unread: "not a transaction",
  code: "gmail check",
  dismissed: "dismissed",
};

export function Recent({ emails }: { emails: Email[] }) {
  if (emails.length === 0) return <p className="text-[.9rem] text-ink-soft">Nothing has arrived yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {emails.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-[.9rem]">
          {e.merchant ? (
            <EmailLine email={e} />
          ) : (
            <span className="text-ink-soft">{e.status === "code" ? "Gmail forwarding check" : `An email from ${e.senderDomain ?? "an unknown sender"}`}</span>
          )}
          <span className={badge}>{statusText[e.status]}</span>
        </li>
      ))}
    </ul>
  );
}

export function Hints({ hints }: { hints: Hint[] }) {
  const [editing, setEditing] = useState<Hint | "new" | null>(null);
  const close = useCallback(() => setEditing(null), []);
  return (
    <>
      {hints.length > 0 && (
        <ul className="mb-3 flex flex-col divide-y divide-line rounded-lg border border-line bg-night">
          {hints.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => setEditing(h)} className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 px-3.5 py-2.5 text-left text-[.92rem]">
                <span className="font-semibold">{h.subject}</span>
                <span aria-hidden className="text-ink-soft">→</span>
                <span className="text-ink-soft">{h.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className={btnSoft} onClick={() => setEditing("new")}>
        <Plus className="size-4" aria-hidden /> Add a hint
      </button>
      <Drawer open={editing !== null} onClose={close} title={editing === "new" ? "New hint" : "Edit hint"}>
        {editing && <HintForm hint={editing === "new" ? null : editing} onDone={close} />}
      </Drawer>
    </>
  );
}

function HintForm({ hint, onDone }: { hint: Hint | null; onDone: () => void }) {
  const [state, action] = useActionState(saveHintAction, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="flex flex-col gap-5">
      {hint && <input type="hidden" name="id" value={hint.id} />}
      <p className="text-ink-soft">The AI reads every hint before it reads your bank emails. Write it the way you would tell a friend.</p>
      <Field label="when the email says" name="subject" state={state} hint="A store name, or a card or account number.">
        <input id="subject" name="subject" required maxLength={140} defaultValue={hint?.subject} placeholder="Corner Store" className={input} autoComplete="off" />
      </Field>
      <Field label="it means" name="hint" state={state}>
        <textarea
          id="hint"
          name="hint"
          required
          rows={3}
          maxLength={500}
          defaultValue={hint?.hint}
          placeholder="Snacks, category Food. Or: card ending 1234 is my savings account."
          className={textarea}
        />
      </Field>
      <FormError state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <Submit className={btnPrimary}>{hint ? "Save hint" : "Add hint"}</Submit>
        {hint && <DeleteHint id={hint.id} onDone={onDone} />}
      </div>
    </form>
  );
}

function DeleteHint({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className={btn}
      disabled={busy}
      onClick={() =>
        start(async () => {
          const res = await deleteHintAction(id);
          if (res?.ok) onDone();
        })
      }
    >
      {busy ? "removing…" : "remove hint"}
    </button>
  );
}
