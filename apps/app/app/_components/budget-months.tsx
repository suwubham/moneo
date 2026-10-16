import Link from "next/link";
import { monthLabel } from "@/lib/core/dates";
import { formatMoney } from "@/lib/core/money";
import type { HistoryPoint } from "./charts";

const fill = { fine: "bg-steel", close: "bg-amber", over: "bg-accent" } as const;
const words = { fine: "on track", close: "close", over: "over" } as const;

// One row per month, newest first, so months read side by side instead of one at a time.
export function BudgetMonths({ history, limit, currency, href }: { history: HistoryPoint[]; limit: number; currency: string; href: (month: string) => string }) {
  return (
    <ol className="flex flex-col divide-y divide-line">
      {[...history].reverse().map((h) => {
        const ratio = limit > 0 ? h.spent / limit : 0;
        const status = ratio > 1 ? "over" : ratio >= 0.8 ? "close" : "fine";
        return (
          <li key={h.key}>
            <Link href={href(h.key)} className="wash grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5">
              <span className="label whitespace-nowrap text-ink">{monthLabel(h.key).replace(/(\w{3})\w* (\d{4})/, "$1 $2").toLowerCase()}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-night-3">
                <span className={`grow-x block h-full origin-left rounded-full ${fill[status]}`} style={{ transform: `scaleX(${Math.min(1, ratio)})` }} />
              </span>
              <span className="flex items-baseline justify-end gap-2 whitespace-nowrap">
                <span className="text-[.9rem] font-semibold tabular-nums">{formatMoney(h.spent, currency, { compact: true })}</span>
                <span className={`label w-[5.5rem] text-right ${status === "over" ? "text-accent" : status === "close" ? "text-amber" : ""}`}>
                  {Math.round(ratio * 100)}% {words[status]}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
