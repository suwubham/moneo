import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, shiftMonth, todayIso } from "@/lib/core/dates";
import { MonthPicker } from "./month-picker";
import { RangePicker } from "./range-picker";

const arrow =
  "grid size-9 place-items-center rounded-full border border-line bg-night-3 text-ink-soft transition-colors duration-300 ease-soft hover:border-steel hover:text-ink";

// Arrows step a month; the middle opens a picker for any month (and, where allowed, any dates).
export function MonthSwitch({
  month,
  href,
  range,
  allowRange = false,
}: {
  month: string;
  href: (month: string) => string;
  range?: { from: string; to: string } | null;
  allowRange?: boolean;
}) {
  const now = currentMonth().key;
  const next = shiftMonth(month, 1).key;
  // Pages that can show any span get the calendar; month-only pages get the month grid.
  const picker = allowRange ? (
    <RangePicker base={href(month)} month={month} today={todayIso()} range={range} />
  ) : (
    <MonthPicker base={href(month)} month={month} now={now} />
  );
  if (range) return picker;
  return (
    <div className="flex items-center gap-1.5">
      <Link href={href(shiftMonth(month, -1).key)} className={arrow} aria-label="Previous month" scroll={false}>
        <ChevronLeft className="size-4" />
      </Link>
      {picker}
      {month < now ? (
        <Link href={href(next)} className={arrow} aria-label="Next month" scroll={false}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={`${arrow} opacity-40`} aria-hidden>
          <ChevronRight className="size-4" />
        </span>
      )}
    </div>
  );
}
