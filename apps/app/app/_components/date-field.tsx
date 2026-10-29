"use client";

import { DayPicker } from "@daypicker/react";
import "@daypicker/react/style.css";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { dayLabel, shiftDays } from "@/lib/core/dates";
import { control } from "./styles";

const pad = (n: number) => String(n).padStart(2, "0");
// Calendar days are local dates; the form sends plain YYYY-MM-DD so no time zone sneaks in.
const toDate = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const quick =
  "h-11 shrink-0 rounded-full border border-line bg-night px-3.5 font-mono text-[.8rem] text-ink-soft transition-colors duration-200 ease-soft hover:border-steel hover:text-ink aria-pressed:border-ink aria-pressed:text-ink";
const navBtn =
  "grid size-8 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-200 ease-soft hover:border-steel hover:text-ink disabled:opacity-30";

// A day for a transaction: one tap for today or yesterday, or open the calendar under the field for any other day.
export function DateField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const today = toIso(new Date());
  const [value, setValue] = useState(defaultValue || today);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(() => toDate(value));
  const pick = (iso: string) => {
    setValue(iso);
    setOpen(false);
  };

  return (
    <div
      // Escape closes the calendar, not the drawer around it.
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          setOpen(false);
        }
      }}
    >
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1.5">
        <button
          id={name}
          type="button"
          aria-expanded={open}
          onClick={() => {
            setShown(toDate(value));
            setOpen((o) => !o);
          }}
          className={`${control} flex min-w-0 flex-1 items-center gap-2.5 text-left ${open ? "border-steel" : ""}`}
        >
          <CalendarDays className="size-4 shrink-0 text-ink-soft" aria-hidden />
          <span className="truncate">{dayLabel(value, today)}</span>
        </button>
        <button type="button" aria-pressed={value === today} onClick={() => pick(today)} className={quick}>
          today
        </button>
        <button type="button" aria-pressed={value === shiftDays(today, -1)} onClick={() => pick(shiftDays(today, -1))} className={quick}>
          yesterday
        </button>
      </div>
      {open && (
        <div className="cal pop mt-2 flex justify-center rounded-[1.1rem] border border-line bg-night p-3">
          <DayPicker
            mode="single"
            required
            selected={toDate(value)}
            onSelect={(d) => d && pick(toIso(d))}
            month={shown}
            onMonthChange={setShown}
            weekStartsOn={0}
            showOutsideDays
            autoFocus
            components={{
              Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />),
            }}
            classNames={{ button_previous: navBtn, button_next: navBtn }}
          />
        </div>
      )}
    </div>
  );
}
