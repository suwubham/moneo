"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const longFmt = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" });

const cell =
  "rounded-full py-2 font-mono text-[.8rem] transition-colors duration-200 ease-soft disabled:pointer-events-none disabled:opacity-30";

// A year at a glance: pick any month up to this one.
export function MonthPicker({ base, month, now }: { base: string; month: string; now: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
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
    for (const [k, v] of Object.entries(set)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    url.searchParams.delete("page");
    setOpen(false);
    start(() => router.push(`${url.pathname}${url.search}`, { scroll: false }));
  };

  const label = longFmt.format(new Date(`${month}-01T00:00:00Z`));
  const nowYear = Number(now.slice(0, 4));

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setYear(Number(month.slice(0, 4)));
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
          aria-label="Pick a month"
          className="pop absolute top-11 left-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-[1.1rem] border border-line bg-night-2 p-4 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)]"
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setYear((y) => y - 1)} className="grid size-8 place-items-center rounded-full text-ink-soft hover:text-ink" aria-label="Previous year">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-mono text-[.9rem] font-semibold">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= nowYear}
              className="grid size-8 place-items-center rounded-full text-ink-soft hover:text-ink disabled:opacity-30"
              aria-label="Next year"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {names.map((n, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const on = key === month;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={key > now}
                  onClick={() => go({ month: key })}
                  aria-current={on ? "date" : undefined}
                  className={`${cell} ${on ? "bg-scene text-night" : key === now ? "border border-steel text-ink" : "text-ink-soft hover:bg-night-3 hover:text-ink"}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {month !== now && (
            <button type="button" onClick={() => go({ month: now })} className="label mt-3 underline">
              back to this month
            </button>
          )}
        </div>
      )}
    </div>
  );
}
