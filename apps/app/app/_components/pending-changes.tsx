"use client";

import { CloudUpload } from "lucide-react";
import { formatMoney } from "@/lib/core/money";
import { discard, retry } from "@/lib/offline/sync";
import { CategoryIcon } from "./category-icon";
import { badge, btn, card } from "./styles";
import { useSync } from "./sync-provider";

type Cat = { id: string; name: string; icon?: string | null; color?: string | null };

const kindWord = { create: "new", update: "edit", delete: "delete" } as const;

// Changes made on this device that the server has not saved yet, above the list they will join.
export function PendingChanges({ categories, accounts, currency, account }: { categories: Cat[]; accounts: { id: string; name: string }[]; currency: string; account?: string }) {
  const { pending } = useSync();
  const shown = pending.filter((o) => !account || o.kind === "delete" || o.input.accountId === account);
  if (shown.length === 0) return null;
  return (
    <section aria-labelledby="pending" className={`${card} mb-5 overflow-hidden border-dashed`}>
      <h2 id="pending" className="label flex items-center gap-2 border-b border-line px-4 py-2 sm:px-5">
        <CloudUpload className="size-4 text-steel" aria-hidden /> waiting to sync
      </h2>
      <ul className="divide-y divide-line">
        {shown.map((o) => {
          const cat = o.kind === "delete" ? null : (categories.find((c) => c.id === o.input.categoryId) ?? null);
          const amount = o.kind === "delete" ? null : (o.input.direction === "out" ? -1 : 1) * Number(o.input.amount);
          return (
            <li key={o.opId} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3.5 px-4 py-3 sm:px-5">
              <CategoryIcon category={cat} />
              <span className="min-w-0">
                <span className={`block truncate font-semibold ${o.kind === "delete" ? "line-through" : ""}`}>
                  {o.kind === "delete" ? o.label : o.input.description}
                </span>
                <span className="label flex flex-wrap items-center gap-1.5">
                  <span className={badge}>{kindWord[o.kind]}</span>
                  {o.kind !== "delete" && (
                    <span className="truncate">
                      {o.input.occurredOn} · {accounts.find((a) => a.id === o.input.accountId)?.name ?? "account"}
                    </span>
                  )}
                  {o.failed && <span className="text-accent">{o.failed.message}</span>}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1.5">
                {amount != null && <span className={`font-semibold tabular-nums ${amount > 0 ? "text-steel" : ""}`}>{formatMoney(amount, currency, { sign: amount > 0 })}</span>}
                {o.failed && (
                  <span className="flex gap-1.5">
                    <button type="button" className={btn} onClick={() => void retry(o.opId)}>
                      try again
                    </button>
                    <button type="button" className={btn} onClick={() => void discard(o.opId)}>
                      discard
                    </button>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
