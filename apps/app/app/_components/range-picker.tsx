"use client";

import { DayPicker, type DateRange } from "@daypicker/react";
import "@daypicker/react/style.css";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { btn } from "./styles";

const pad = (n: number) => String(n).padStart(2, "0");
// Calendar days are local dates; the URL keeps plain YYYY-MM-DD so no time zone sneaks in.
const toDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const short = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" });
const shortYear = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const long = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

function rangeLabel(from: Date, to: Date) {
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${(sameYear ? short : shortYear).format(from)} – ${shortYear.format(to)}`;
}

type Preset = { label: string; month?: string; range?: [Date, Date] };

function presets(today: Date): Preset[] {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return [
    { label: "This month", month: monthKey(first) },
    { label: "Last month", month: monthKey(lastMonth) },
    { label: "Last 7 days", range: [addDays(today, -6), today] },
    { label: "Last 30 days", range: [addDays(today, -29), today] },
    { label: "Last 3 months", range: [new Date(today.getFullYear(), today.getMonth() - 2, 1), today] },
    { label: "This year", range: [new Date(today.getFullYear(), 0, 1), today] },
  ];
}

const presetBtn =
  "w-full rounded-lg px-3 py-2 text-left font-mono text-[.8rem] text-ink-soft transition-colors duration-200 ease-soft hover:bg-night-3 hover:text-ink aria-pressed:bg-night-3 aria-pressed:text-ink";
const navBtn =
  "grid size-8 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-200 ease-soft hover:border-steel hover:text-ink disabled:opacity-30";

// One calendar for a month or any span: tap a start day, then an end day. Presets cover the usual asks.
export function RangePicker({
  base,
  month,
  today: todayIso,
  range,
}: {
  base: string;
  month: string;
  today: string;
  range?: { from: string; to: string } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [two, setTwo] = useState(true);
  const today = toDate(todayIso);
  const current = range ? { from: toDate(range.from), to: toDate(range.to) } : { from: toDate(`${month}-01`), to: addDays(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1), -1) };
  const [picked, setPicked] = useState<DateRange | undefined>(current);
  const [shown, setShown] = useState<Date>(new Date(current.from.getFullYear(), current.from.getMonth() - 1, 1));
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("pointerdown", onDown);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("pointerdown", onDown);
      removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (set: Record<string, string | undefined>) => {
    const url = new URL(base, "http://x");
    for (const k of ["month", "from", "to", "page"]) url.searchParams.delete(k);
    for (const [k, v] of Object.entries(set)) if (v) url.searchParams.set(k, v);
    setOpen(false);
    start(() => router.push(`${url.pathname}${url.search}`, { scroll: false }));
  };

  const apply = (from: Date, to: Date) => {
    const isWholeMonth = from.getDate() === 1 && addDays(to, 1).getDate() === 1 && from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
    if (isWholeMonth) go({ month: monthKey(from) });
    else go({ from: toIso(from), to: toIso(to) });
  };

  const label = range ? rangeLabel(current.from, current.to) : long.format(current.from);
  const days = picked?.from && picked.to ? Math.round((picked.to.getTime() - picked.from.getTime()) / 86_400_000) + 1 : 0;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setPicked(current);
          setTwo(matchMedia("(min-width: 768px)").matches);
          setShown(matchMedia("(min-width: 768px)").matches ? new Date(current.to.getFullYear(), current.to.getMonth() - 1, 1) : new Date(current.to.getFullYear(), current.to.getMonth(), 1));
          setOpen((o) => !o);
        }}
        className={`flex h-9 items-center gap-2 rounded-full border border-line bg-night-2 px-4 font-mono text-[.85rem] text-ink transition-[border-color,opacity] duration-300 ease-soft hover:border-steel ${pending ? "opacity-60" : ""}`}
      >
        <CalendarDays className="size-4 text-ink-soft" aria-hidden />
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pick dates"
          // A sheet above the tab bar on phones; a dropdown under the button from md up, over the floating nav.
          className="rise-1 fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex max-h-[calc(100svh-7rem)] flex-col overflow-y-auto rounded-[1.1rem] border border-line bg-night-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] md:absolute md:inset-x-auto md:top-11 md:bottom-auto md:left-0 md:max-h-none md:w-max md:flex-row md:overflow-hidden"
        >
          <ul className="flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 md:w-40 md:flex-col md:overflow-visible md:border-r md:border-b-0 [scrollbar-width:none]">
            {presets(today).map((p) => {
              const on = p.month ? !range && p.month === month : Boolean(range && p.range && toIso(p.range[0]) === range.from && toIso(p.range[1]) === range.to);
              return (
                <li key={p.label} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    className={`${presetBtn} whitespace-nowrap`}
                    onClick={() => (p.month ? go({ month: p.month }) : p.range && apply(p.range[0], p.range[1]))}
                  >
                    {p.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="cal flex flex-col items-center p-3 md:items-stretch">
            <DayPicker
              mode="range"
              selected={picked}
              onSelect={setPicked}
              resetOnSelect
              numberOfMonths={two ? 2 : 1}
              month={shown}
              onMonthChange={setShown}
              endMonth={today}
              disabled={{ after: today }}
              weekStartsOn={0}
              showOutsideDays={false}
              components={{
                Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />),
              }}
              classNames={{ button_previous: navBtn, button_next: navBtn }}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p className="label">
                {picked?.from && picked.to
                  ? `${rangeLabel(picked.from, picked.to)} · ${days} day${days === 1 ? "" : "s"}`
                  : picked?.from
                    ? `${shortYear.format(picked.from)} · now pick an end day`
                    : "Pick a start day"}
              </p>
              <button type="button" className={btn} disabled={!picked?.from} onClick={() => picked?.from && apply(picked.from, picked.to ?? picked.from)}>
                Show these days
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
