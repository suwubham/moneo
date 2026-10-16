"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { controlSm } from "../../_components/styles";

type Option = { id: string; name: string };
type Values = { q?: string; category?: string; budget?: string; type?: "in" | "out"; min?: string; max?: string };

const seg = "rounded-full px-3.5 py-1.5 font-mono text-[.78rem] transition-colors duration-200 ease-soft";
const types: [Values["type"], string][] = [
  [undefined, "all"],
  ["in", "money in"],
  ["out", "money out"],
];

// Filters apply as you pick them; typed ones (search, amounts) wait for a pause. The list keeps its place while it reloads.
export function FilterBar({
  base,
  values,
  categories,
  budgets,
  period,
}: {
  base: string;
  values: Values;
  categories: Option[];
  budgets: Option[];
  period: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(values.q ?? "");
  const [min, setMin] = useState(values.min ?? "");
  const [max, setMax] = useState(values.max ?? "");
  const search = useRef<HTMLInputElement>(null);

  const go = (patch: Partial<Values>) => {
    const url = new URL(base, "http://x");
    const next = { ...values, ...patch };
    for (const [k, v] of Object.entries(next)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    url.searchParams.delete("page");
    start(() => router.replace(`${url.pathname}${url.search}`, { scroll: false }));
  };

  useEffect(() => {
    const clean = (v: string) => (v.trim() && Number(v) >= 0 ? String(Number(v)) : undefined);
    const patch = { q: q.trim() || undefined, min: clean(min), max: clean(max) };
    if (patch.q === values.q && patch.min === values.min && patch.max === values.max) return;
    const t = setTimeout(() => go(patch), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, min, max]);

  // "/" jumps to search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      search.current?.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const any = Boolean(values.q || values.category || values.budget || values.type || values.min || values.max);
  return (
    <div className={`flex flex-col gap-3 transition-opacity duration-300 ease-soft ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {period}
        <label className="relative min-w-0 flex-1 basis-56">
          <span className="sr-only">Search descriptions</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            ref={search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="search descriptions  /"
            className={`${controlSm} w-full pl-9`}
            maxLength={80}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Money in or out" className="flex w-full gap-0.5 rounded-full border border-line bg-night-2 p-0.5 sm:w-auto">
          {types.map(([v, text]) => (
            <button
              key={text}
              type="button"
              aria-pressed={values.type === v}
              onClick={() => go({ type: v })}
              className={`${seg} flex-1 sm:flex-none ${values.type === v ? "bg-scene text-night" : "text-ink-soft hover:text-ink"}`}
            >
              {text}
            </button>
          ))}
        </div>
        <label className="min-w-0 flex-1 basis-[calc(50%-.25rem)] sm:basis-auto sm:flex-none">
          <span className="sr-only">Category</span>
          <select value={values.category ?? ""} onChange={(e) => go({ category: e.target.value || undefined })} className={`${controlSm} w-full`}>
            <option value="">All categories</option>
            <option value="none">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {budgets.length > 0 && (
          <label className="min-w-0 flex-1 basis-[calc(50%-.25rem)] sm:basis-auto sm:flex-none">
            <span className="sr-only">Budget</span>
            <select value={values.budget ?? ""} onChange={(e) => go({ budget: e.target.value || undefined })} className={`${controlSm} w-full`}>
              <option value="">All budgets</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex w-full items-center gap-1.5 sm:w-auto">
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">Smallest amount</span>
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="min amount" className={`${controlSm} w-full text-right tabular-nums sm:w-28`} />
          </label>
          <span className="label">to</span>
          <label className="flex-1 sm:flex-none">
            <span className="sr-only">Largest amount</span>
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="max amount" className={`${controlSm} w-full text-right tabular-nums sm:w-28`} />
          </label>
        </div>
        {any && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setMin("");
              setMax("");
              go({ q: undefined, category: undefined, budget: undefined, type: undefined, min: undefined, max: undefined });
            }}
            className="label inline-flex items-center gap-1 rounded-full px-2 py-1 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden /> clear filters
          </button>
        )}
      </div>
    </div>
  );
}
