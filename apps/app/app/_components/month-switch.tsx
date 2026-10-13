import Link from "next/link";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/core/dates";

const arrow =
  "grid size-9 place-items-center rounded-full border border-line bg-night-3 text-ink-soft transition-colors duration-300 ease-soft hover:border-steel hover:text-ink";

export function MonthSwitch({ month, href }: { month: string; href: (month: string) => string }) {
  const now = currentMonth().key;
  const next = shiftMonth(month, 1).key;
  return (
    <div className="flex items-center gap-2">
      <Link href={href(shiftMonth(month, -1).key)} className={arrow} aria-label="Previous month">
        ←
      </Link>
      <span className="min-w-36 text-center font-mono text-[.85rem]">{monthLabel(month)}</span>
      {month < now ? (
        <Link href={href(next)} className={arrow} aria-label="Next month">
          →
        </Link>
      ) : (
        <span className={`${arrow} opacity-40`} aria-hidden>
          →
        </span>
      )}
    </div>
  );
}
