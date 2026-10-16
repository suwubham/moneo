"use client";

import { useClerk } from "@clerk/nextjs";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import type { ActionState } from "@/lib/core/action-state";
import { currencies } from "@/lib/core/money";
import { Field, FormError, Submit } from "../../_components/form";
import { btnDanger, btnPrimary, btnSoft, control, input } from "../../_components/styles";
import type { ImportResult } from "@/lib/modules/imports/service";
import { type CategoryColor, type CategoryIcon as IconKey, categoryColors, categoryIcons, lookOf } from "@/lib/modules/categories/look";
import { CategoryIcon, colorVar, icons } from "../../_components/category-icon";
import { Drawer } from "../../_components/drawer";
import { ArrowUpDown } from "lucide-react";
import { SortableList } from "../../_components/sortable-list";
import { addCategoryAction, currencyAction, deleteCategoryAction, deleteEverythingAction, importCashewAction, reorderCategoriesAction, updateCategoryAction } from "./actions";

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

export function ImportCashew({ currency }: { currency: string }) {
  const [state, action] = useActionState<ActionState<ImportResult>, FormData>(importCashewAction, null);
  const done = state?.ok ? state.data : undefined;
  const otherCurrency = done?.currencies.find((c) => c !== currency);
  return (
    <form
      key={state?.ok ? state.at : 0}
      action={(form) => {
        form.set("tz", String(new Date().getTimezoneOffset()));
        action(form);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="cashew backup" name="file" state={state}>
        <input id="file" name="file" type="file" required accept=".sql,.db,.sqlite" className={`${control} w-72 py-2`} />
      </Field>
      <Submit className={btnSoft} pending="importing…">
        Import
      </Submit>
      <FormError state={state} />
      {done && (
        <p role="status" className="w-full text-[.9rem] text-ink-soft">
          Imported {done.imported} transactions
          {done.duplicates > 0 && `, skipped ${done.duplicates} already here`}
          {done.skipped > 0 && `, left out ${done.skipped} planned or empty ones`}.
          {done.budgetsAdded > 0 && ` Added ${done.budgetsAdded} budget${done.budgetsAdded === 1 ? "" : "s"}.`}
          {done.linked > 0 && ` Put ${done.linked} transaction${done.linked === 1 ? "" : "s"} into their budget.`}
          {done.budgetsSkipped > 0 && ` ${done.budgetsSkipped} Cashew budget${done.budgetsSkipped === 1 ? " is" : "s are"} not monthly or cover only some wallets, so they stayed out.`}
          {otherCurrency && ` The backup is in ${otherCurrency}; your currency setting is ${currency}.`}
        </p>
      )}
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

type Cat = { id: string; name: string; icon: string | null; color: string | null };

// A chip per category; tapping it opens an editor for name, icon and colour.
export function CategoryChip({ category }: { category: Cat }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <span className="flex items-center gap-1 rounded-full border border-line bg-night py-1 pr-1.5 pl-1 text-[.9rem] transition-colors duration-300 ease-soft hover:border-steel">
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full pr-1" aria-label={`Edit ${category.name}`}>
          <CategoryIcon category={category} size="sm" />
          {category.name}
        </button>
        <RemoveCategory id={category.id} name={category.name} />
      </span>
      <Drawer open={open} onClose={close} title="Edit category">
        <CategoryEditor category={category} onDone={close} />
      </Drawer>
    </>
  );
}

const pick = "grid size-11 place-items-center rounded-full border transition-colors duration-200 ease-soft";

function CategoryEditor({ category, onDone }: { category: Cat; onDone: () => void }) {
  const [state, action] = useActionState(updateCategoryAction, null);
  const start = lookOf(category);
  const [icon, setIcon] = useState<IconKey>(start.icon);
  const [color, setColor] = useState<CategoryColor>(start.color);
  const [name, setName] = useState(category.name);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="color" value={color} />
      <div className="flex items-center gap-4">
        <CategoryIcon category={{ name, icon, color }} size="lg" />
        <p className="text-[1.2rem] font-bold">{name || "…"}</p>
      </div>
      <Field label="name" name="name" state={state}>
        <input id="name" name="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="off" />
      </Field>
      <fieldset>
        <legend className="label mb-2">colour</legend>
        <div className="flex flex-wrap gap-2">
          {categoryColors.map((c) => (
            <label key={c} className={`${pick} cursor-pointer ${c === color ? "border-ink" : "border-transparent"}`}>
              <input type="radio" name="color-pick" value={c} checked={c === color} onChange={() => setColor(c)} className="sr-only" />
              <span className="sr-only">{c}</span>
              <span aria-hidden className="size-6 rounded-full" style={{ background: colorVar(c) }} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label mb-2">icon</legend>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
          {categoryIcons.map((k) => {
            const Icon = icons[k];
            const on = k === icon;
            return (
              <label
                key={k}
                className={`${pick} cursor-pointer ${on ? "border-transparent" : "border-line text-ink-soft hover:text-ink"}`}
                style={on ? { background: `color-mix(in srgb, ${colorVar(color)} 20%, transparent)`, color: colorVar(color) } : undefined}
              >
                <input type="radio" name="icon-pick" value={k} checked={on} onChange={() => setIcon(k)} className="sr-only" />
                <span className="sr-only">{k}</span>
                <Icon aria-hidden className="size-[1.15rem]" strokeWidth={1.9} />
              </label>
            );
          })}
        </div>
      </fieldset>
      <FormError state={state} />
      <div>
        <Submit className={btnPrimary}>Save category</Submit>
      </div>
    </form>
  );
}

type OrderCat = Cat & { kind: "expense" | "income" };

// Spending and income each keep their own order; both save together.
export function ReorderCategories({ categories }: { categories: OrderCat[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (categories.length < 2) return null;
  return (
    <>
      <button type="button" className={btnSoft} onClick={() => setOpen(true)}>
        <ArrowUpDown className="size-4" aria-hidden /> Reorder
      </button>
      <Drawer open={open} onClose={close} title="Reorder categories">
        <CategoryOrder categories={categories} onDone={close} />
      </Drawer>
    </>
  );
}

function CategoryOrder({ categories, onDone }: { categories: OrderCat[]; onDone: () => void }) {
  const [spending, setSpending] = useState(categories.filter((c) => c.kind === "expense"));
  const [income, setIncome] = useState(categories.filter((c) => c.kind === "income"));
  const [state, setState] = useState<ActionState>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const order = [...spending, ...income];
  const before = [...categories.filter((c) => c.kind === "expense"), ...categories.filter((c) => c.kind === "income")];
  const changed = order.some((c, i) => c.id !== before[i].id);
  const icon = (c: OrderCat) => <CategoryIcon category={c} size="sm" />;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-soft">This order is used in the category pickers, filters and lists.</p>
      <section>
        <h3 className="label mb-2">spending</h3>
        <SortableList items={spending} onChange={setSpending} render={icon} />
      </section>
      {income.length > 0 && (
        <section>
          <h3 className="label mb-2">income</h3>
          <SortableList items={income} onChange={setIncome} render={icon} />
        </section>
      )}
      <FormError state={state} />
      <div>
        <button type="button" className={btnPrimary} disabled={!changed || busy} onClick={() => start(async () => setState(await reorderCategoriesAction(order.map((c) => c.id))))}>
          {busy ? "Saving…" : "Save order"}
        </button>
      </div>
    </div>
  );
}
