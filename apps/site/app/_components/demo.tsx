"use client";

import { type CSSProperties, type FormEvent, useState } from "react";

// A working copy of the app's Overview (apps/app/app/(app)/page.tsx) with made-up numbers.
// Everything lives in this component's state: nothing is sent or saved, and a reload starts over.
// Money is whole cents, so adding entries never meets float rounding.

const MONTHS = [
  { key: "may", name: "May" },
  { key: "jun", name: "June" },
  { key: "jul", name: "July" },
  { key: "aug", name: "August" },
  { key: "sep", name: "September" },
  { key: "oct", name: "October" },
];
const NOW = MONTHS.length - 1;
const CATS = ["Rent", "Groceries", "Dining", "Transport", "Subscriptions", "Shopping"] as const;
type Cat = (typeof CATS)[number];

const $ = (d: number) => Math.round(d * 100);
const IN = [4980, 5120, 4870, 5260, 5010, 5420].map($);
// Spending per category per month, in CATS order; a month's money out is its row's sum.
const SPEND = [
  [1450, 640, 380, 240, 96, 804],
  [1450, 702, 455, 262, 96, 1015],
  [1450, 590, 341, 228, 96, 835],
  [1450, 688, 498, 301, 108, 1075],
  [1450, 575, 350, 255, 108, 752],
  [1450, 612, 412, 268, 108, 1062],
].map((row) => row.map($));
const NET = $(24860);

type Entry = { id: string; name: string; cents: number; cat: Cat | "Income"; where: string };

// The newest few of each month. Past months reuse the shapes with their own days and amounts.
const RECENT: Omit<Entry, "id" | "where">[] = [
  { name: "Corner Grocer", cents: -4218, cat: "Groceries" },
  { name: "Salary", cents: 271000, cat: "Income" },
  { name: "Noodle Bar", cents: -1850, cat: "Dining" },
  { name: "Metro card", cents: -3000, cat: "Transport" },
  { name: "Streamly", cents: -1099, cat: "Subscriptions" },
  { name: "Bookshop", cents: -2400, cat: "Shopping" },
];
const DAYS = ["Today", "Yesterday", "Fri", "Thu", "Wed", "Tue"];
const ACCOUNTS = ["Visa", "Checking", "Visa", "Debit", "Visa", "Visa"];

function recentOf(m: number): Entry[] {
  return RECENT.map((r, i) => ({
    ...r,
    id: `${m}-${i}`,
    cents: m === NOW ? r.cents : Math.round(r.cents * (0.85 + ((m * 7 + i * 3) % 6) / 20)),
    where: `${m === NOW ? DAYS[i] : `${MONTHS[m].name.slice(0, 3)} ${28 - i * 3}`} · ${ACCOUNTS[i]}`,
  }));
}

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "always" });
const money = (c: number) => whole.format(c / 100);
const signed = (c: number) => exact.format(c / 100);

const WORDS: [RegExp, Cat | "Income"][] = [
  [/salary|paid|refund|got|received|payday|income/, "Income"],
  [/rent|landlord/, "Rent"],
  [/grocer|market|milk|bread|eggs|veg|fruit/, "Groceries"],
  [/coffee|lunch|dinner|breakfast|pizza|noodle|burger|cafe|bar|restaurant|takeaway|tea/, "Dining"],
  [/uber|taxi|cab|bus|train|metro|fuel|gas|petrol|parking/, "Transport"],
  [/netflix|spotify|subscription|streamly|icloud|gym/, "Subscriptions"],
];

/** "coffee 4.50 yesterday on visa" → the parts the app's own parser would pull out, roughly. */
function parse(text: string) {
  const t = text.trim().toLowerCase();
  const amount = t.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!amount) return null;
  const cents = Math.round(parseFloat(amount[1].replace(",", ".")) * 100);
  if (!cents || cents > 10_000_000) return null;
  const cat = WORDS.find(([re]) => re.test(t))?.[1] ?? "Shopping";
  const account = t.match(/\b(?:on|with|from|via)\s+(?:my\s+)?([a-z]+)/)?.[1];
  const day = t.match(/\b(today|yesterday|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/)?.[1];
  const name = t
    .replace(amount[0], "")
    .replace(/\b(?:on|with|from|via)\s+(?:my\s+)?[a-z]+/, "")
    .replace(/\b(today|yesterday|mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/, "")
    .replace(/[$€£]|\bfor\b|\bat\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    name: cap(name || cat.toLowerCase()),
    cents: cat === "Income" ? cents : -cents,
    cat,
    where: `${day ? cap(day === "today" || day === "yesterday" ? day : day.slice(0, 3)) : "Today"} · ${cap(account ?? "Visa")}`,
  };
}

function Chevron({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Delta({ now, before, upIsGood }: { now: number; before?: number; upIsGood: boolean }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return null;
  const good = pct > 0 === upIsGood;
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[.72rem] ${good ? "border-steel/50 text-steel" : "border-amber/50 text-amber"}`}>
      {pct > 0 ? "+" : ""}
      {pct}%<span className="sr-only"> against the month before</span>
    </span>
  );
}

const tile = "relative overflow-hidden rounded-[1.1rem] border border-line bg-night-2 p-5";
const big = "text-[clamp(2rem,4.4vw,3rem)] leading-none font-extrabold tracking-[-0.045em] tabular-nums";
const mid = "block text-[clamp(1.2rem,2.2vw,1.8rem)] leading-none font-extrabold tracking-[-0.04em] tabular-nums";
const bar = "peek-bar block size-full rounded-t-[3px] transition-[transform,opacity] duration-[450ms] ease-snap";
const i = (n: number) => ({ "--i": n }) as CSSProperties;

// Ninety days of net worth: a slow climb with two paydays and a rent day.
const TREND = (() => {
  const pts: number[] = [];
  let v = 21400;
  for (let d = 0; d < 90; d++) {
    v += 22 + Math.sin(d / 5) * 40;
    if (d === 28 || d === 58) v += 1800;
    if (d === 31 || d === 61) v -= 1450;
    pts.push(v);
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  return pts.map((p, d) => `${d === 0 ? "M" : "L"}${((d / 89) * 240).toFixed(1)} ${(56 - ((p - lo) / (hi - lo)) * 50).toFixed(1)}`).join(" ");
})();

export function Demo() {
  const [month, setMonth] = useState(NOW);
  const [cat, setCat] = useState<Cat | null>(null);
  const [added, setAdded] = useState<Entry[]>([]);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");

  // This month with the visitor's own entries folded in.
  const spend = SPEND.map((row, m) =>
    m === NOW ? row.map((c, k) => c + added.filter((a) => a.cat === CATS[k]).reduce((s, a) => s - a.cents, 0)) : row,
  );
  const ins = IN.map((c, m) => (m === NOW ? c + added.filter((a) => a.cents > 0).reduce((s, a) => s + a.cents, 0) : c));
  const outs = spend.map((row) => row.reduce((s, c) => s + c, 0));
  const net = NET + added.reduce((s, a) => s + a.cents, 0);
  const peak = Math.max(...ins, ...outs);
  const rows = CATS.map((k, n) => ({ k, c: spend[month][n] })).sort((a, b) => b.c - a.c);
  const top = rows[0].c;
  const latest = [...(month === NOW ? added : []), ...recentOf(month)].filter((e) => !cat || e.cat === cat).slice(0, 4);
  const draft = parse(text);
  const name = MONTHS[month].name.toLowerCase();

  function pick(m: number) {
    setMonth(Math.max(0, Math.min(NOW, m)));
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const entry = { ...draft, id: `a${added.length}-${Date.now()}` };
    setAdded((a) => [entry, ...a].slice(0, 8));
    setMonth(NOW);
    setCat(null);
    setText("");
    setSaid(`Added ${entry.name}, ${signed(entry.cents)}, ${entry.cat}. October updated.`);
  }

  return (
    <div className="grid grid-cols-6 gap-3 lg:grid-cols-12">
      <div className="col-span-6 flex flex-wrap items-center justify-between gap-3 px-1 lg:col-span-12">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => pick(month - 1)} disabled={month === 0} aria-label="Month before" className="grid size-9 place-items-center rounded-full border border-line bg-night-2 transition-[scale,opacity] duration-[120ms] active:scale-95 disabled:opacity-40">
            <Chevron d="M10 3 5 8l5 5" />
          </button>
          <p className="min-w-36 rounded-full border border-line bg-night-2 px-4 py-2 text-center font-mono text-[.8rem]" aria-live="polite">
            {MONTHS[month].name} 2026
          </p>
          <button type="button" onClick={() => pick(month + 1)} disabled={month === NOW} aria-label="Month after" className="grid size-9 place-items-center rounded-full border border-line bg-night-2 transition-[scale,opacity] duration-[120ms] active:scale-95 disabled:opacity-40">
            <Chevron d="m6 3 5 5-5 5" />
          </button>
        </div>
        <p className="label">sample numbers · try it, nothing is saved</p>
      </div>

      <div className={`${tile} col-span-6 flex flex-col justify-between gap-6 rounded-[2.4rem_1.2rem_2.4rem_1.2rem] bg-linear-to-br from-crimson/30 to-night-2`}>
        <span aria-hidden className="blob blob-e -top-28 -right-28 w-80 opacity-35 blur-xl" />
        <p className="label">net worth · 4 accounts</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p key={net} className={`${big} tick`}>
              {money(net)}
            </p>
            <p className="label mt-2">
              you have <span className="text-ink">{money(net + $(2450))}</span> · you owe <span className="text-ink">{money($(2450))}</span>
            </p>
          </div>
          <svg viewBox="0 0 240 60" className="h-16 w-full sm:w-60" fill="none" aria-hidden>
            <path d={TREND} pathLength={100} className="peek-line" stroke="var(--chart-in)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {[
        { label: "money in", data: ins, color: "var(--chart-in)", upIsGood: true, shape: "" },
        { label: "money out", data: outs, color: "var(--chart-out)", upIsGood: false, shape: "rounded-[1.2rem_2.4rem_1.2rem_2.4rem]" },
      ].map((t) => {
        const max = Math.max(...t.data);
        return (
          <div key={t.label} className={`${tile} ${t.shape} col-span-3 flex min-w-0 flex-col justify-between gap-4`}>
            <p className="label">
              {t.label} · {name}
            </p>
            <div className="flex h-16 items-end gap-1 sm:gap-2">
              {t.data.map((v, n) => (
                <button key={n} type="button" onClick={() => pick(n)} aria-label={`${MONTHS[n].name}, ${t.label} ${money(v)}`} aria-pressed={n === month} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <span className="flex w-full max-w-4 flex-1 items-end">
                    <span className={bar} style={{ ...i(n), background: t.color, transform: `scaleY(${v / max})`, opacity: n === month ? 1 : 0.5 }} />
                  </span>
                  <span className={`font-mono text-[.58rem] sm:text-[.62rem] ${n === month ? "text-ink" : "text-ink-soft"}`}>{MONTHS[n].key}</span>
                </button>
              ))}
            </div>
            <div>
              <p key={t.data[month]} className={`${mid} tick`}>
                {money(t.data[month])}
              </p>
              <p className="label mt-2 min-h-5">
                <Delta now={t.data[month]} before={t.data[month - 1]} upIsGood={t.upIsGood} />
              </p>
            </div>
          </div>
        );
      })}

      <div className={`${tile} col-span-6 flex flex-col max-sm:hidden lg:col-span-7`}>
        <div className="flex items-center justify-between gap-3">
          <p className="label">six months · tap a month</p>
          <p className="label flex gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-chart-in" />
              in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-[2px] bg-chart-out" />
              out
            </span>
          </p>
        </div>
        <div className="mt-5 flex min-h-44 flex-1 items-end gap-[clamp(.5rem,2vw,1.5rem)] border-b border-line pb-px">
          {MONTHS.map((m, n) => (
            <button
              key={m.key}
              type="button"
              onClick={() => pick(n)}
              aria-pressed={n === month}
              aria-label={`${m.name}: in ${money(ins[n])}, out ${money(outs[n])}`}
              className="group relative flex h-full flex-1 items-end justify-center gap-1"
            >
              <span className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full scale-95 rounded-lg border border-line bg-night px-2.5 py-1.5 font-mono text-[.68rem] whitespace-nowrap opacity-0 transition-[opacity,scale] duration-[250ms] ease-soft group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
                <span className="text-chart-in">{money(ins[n])}</span> · <span className="text-chart-out">{money(outs[n])}</span>
              </span>
              {[ins[n], outs[n]].map((v, k) => (
                <span key={k} className="flex h-full w-full max-w-6 items-end">
                  <span className={`${bar} ${k ? "bg-chart-out" : "bg-chart-in"}`} style={{ ...i(n + k / 2), transform: `scaleY(${v / peak})`, opacity: n === month ? 1 : 0.5 }} />
                </span>
              ))}
            </button>
          ))}
        </div>
        <div className="mt-2 flex">
          {MONTHS.map((m, n) => (
            <span key={m.key} className={`flex-1 text-center font-mono text-[.65rem] ${n === month ? "text-ink" : "text-ink-soft"}`}>
              {m.key}
            </span>
          ))}
        </div>
      </div>

      <div className={`${tile} col-span-6 lg:col-span-5`}>
        <div className="flex items-center justify-between gap-3">
          <p className="label">where it went · {name}</p>
          {cat && (
            <button type="button" onClick={() => setCat(null)} className="label underline-offset-4 hover:underline">
              show all
            </button>
          )}
        </div>
        <ul className="mt-3 space-y-1">
          {rows.map((r, n) => (
            <li key={r.k}>
              <button
                type="button"
                onClick={() => setCat(cat === r.k ? null : r.k)}
                aria-pressed={cat === r.k}
                className={`w-full rounded-lg px-2 py-1.5 text-left transition-[opacity,background-color] duration-[250ms] ease-soft hover:bg-night-3 ${cat && cat !== r.k ? "opacity-45" : ""}`}
              >
                <span className="flex items-baseline justify-between gap-3 text-[.95rem]">
                  <span>{r.k}</span>
                  <span className="font-semibold tabular-nums">
                    {money(r.c)}
                    <span className="ml-1.5 font-mono text-[.72rem] font-normal text-ink-soft">{Math.round((r.c / outs[month]) * 100)}%</span>
                  </span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-night-3">
                  <span className="peek-fill block h-full rounded-full bg-chart-out transition-transform duration-[450ms] ease-snap" style={{ ...i(n), transform: `scaleX(${r.c / top})` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={add} className={`${tile} col-span-6 flex flex-col gap-3 lg:col-span-5`}>
        <label htmlFor="demo-say" className="label">
          add one · type it like a text
        </label>
        <div className="flex gap-2">
          <input
            id="demo-say"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="coffee 4.50 yesterday on visa"
            autoComplete="off"
            maxLength={80}
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-night px-3.5 font-mono text-[.85rem] text-ink outline-none transition-colors duration-200 ease-soft placeholder:text-ash focus:border-steel"
          />
          <button type="submit" disabled={!draft} className="h-11 rounded-full border border-line bg-night-3 px-4 font-semibold transition-[scale,opacity,border-color] duration-[120ms] hover:border-steel active:scale-[.97] disabled:opacity-50">
            Add
          </button>
        </div>
        <p className="flex min-h-7 flex-wrap items-center gap-2" aria-hidden>
          {draft ? (
            [draft.cat.toLowerCase(), signed(draft.cents), draft.where.toLowerCase()].map((c, n) => (
              <span key={c + n} className="tick rounded-full border border-line bg-night/70 px-3 py-1 font-mono text-[.72rem]">
                {c}
              </span>
            ))
          ) : (
            <span className="label">it shows what it understood before you add it</span>
          )}
        </p>
        {added.length > 0 && (
          <button type="button" onClick={() => setAdded([])} className="label self-start underline-offset-4 hover:underline">
            undo my entries
          </button>
        )}
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </form>

      <div className={`${tile} col-span-6 lg:col-span-7`}>
        <p className="label">
          latest · {name}
          {cat ? ` · ${cat.toLowerCase()}` : ""}
        </p>
        <ul className="mt-3 divide-y divide-line">
          {latest.map((t) => (
            <li key={t.id} className={`flex items-center justify-between gap-3 py-2.5 ${t.id.startsWith("a") ? "tick" : ""}`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.name}</span>
                <span className="label block truncate">
                  {t.cat} · {t.where}
                </span>
              </span>
              <span className={`font-semibold tabular-nums ${t.cents > 0 ? "text-steel" : ""}`}>{signed(t.cents)}</span>
            </li>
          ))}
          {latest.length === 0 && <li className="label py-2.5">Nothing in {cat?.toLowerCase()} this month.</li>}
        </ul>
      </div>
    </div>
  );
}
