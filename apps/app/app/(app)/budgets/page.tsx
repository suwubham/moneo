import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { aiEnabled } from "@/lib/core/config";
import { requireProfile } from "@/lib/core/auth";
import { currentMonth, daysInMonth, isMonthKey, monthOf, todayIso } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { MonthSwitch } from "../../_components/month-switch";
import { PageTitle } from "../../_components/page-title";
import { ListSkeleton } from "../../_components/skeleton";
import { btnPrimary, card } from "../../_components/styles";
import { EditBudget, NewBudgetButton, Suggestions } from "./budget-ui";

export const metadata: Metadata = { title: "Budgets" };

const fill = { fine: "bg-steel", close: "bg-amber", over: "bg-accent" } as const;
const words = { fine: "on track", close: "close to the limit", over: "over" } as const;
const wordTone = { fine: "", close: "text-amber", over: "text-accent" } as const;

export default function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  return (
    <>
      <PageTitle eyebrow="limits you set" title="Monthly" fancy="budgets." />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Budgets searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Budgets({ searchParams }: { searchParams: PageProps<"/budgets">["searchParams"] }) {
  // Read the session before the clock: Cache Components rejects new Date() ahead of request data.
  const profile = await requireProfile();
  const sp = await searchParams;
  const key = isMonthKey(sp.month) ? sp.month : currentMonth().key;
  const month = monthOf(key);
  const [budgets, categories] = await Promise.all([getBudgetProgress(profile.id, month), getCategories(profile.id)]);

  const expense = categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name }));
  const free = expense.filter((c) => !budgets.some((b) => b.categoryId === c.id));
  const limit = budgets.reduce((s, b) => s + toNumber(b.amount), 0);
  const spent = budgets.reduce((s, b) => s + toNumber(b.spent), 0);

  // How far through the month we are, so a bar can be read against time, not only against the limit.
  const today = todayIso();
  const isNow = key === currentMonth().key;
  const elapsed = isNow ? Number(today.slice(8, 10)) / daysInMonth(key) : key < currentMonth().key ? 1 : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthSwitch month={key} href={(m) => `/budgets?month=${m}`} />
        {free.length > 0 && <NewBudgetButton categories={free} className={btnPrimary} />}
      </div>

      {budgets.length === 0 ? (
        <Empty title="No budgets yet." body="Pick a spending category and a monthly limit. Moneo shows how close you are as the month goes on." />
      ) : (
        <>
          <p className="label">
            <Money value={spent} currency={profile.currency} className="text-ink" /> of{" "}
            <Money value={limit} currency={profile.currency} className="text-ink" /> across {budgets.length} budget{budgets.length === 1 ? "" : "s"}
          </p>
          <ul className="grid gap-3.5 md:grid-cols-2">
            {budgets.map((b) => {
              const { ratio, status } = statusOf(b);
              const left = toNumber(b.amount) - toNumber(b.spent);
              return (
                <li key={b.id}>
                  <EditBudget
                    budget={{ id: b.id, categoryId: b.categoryId, amount: b.amount }}
                    categories={expense}
                    className={`${card} block w-full p-5 text-left transition-[translate,border-color] duration-300 ease-soft hover:-translate-y-0.5 hover:border-steel`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-[1.15rem] font-bold">{b.categoryName}</span>
                      <span className={`label ${wordTone[status]}`}>{words[status]}</span>
                    </span>
                    <span className="relative mt-4 block h-2.5 overflow-hidden rounded-full bg-night">
                      <span
                        className={`absolute inset-0 origin-left rounded-full ${fill[status]} transition-transform duration-700 ease-snap`}
                        style={{ transform: `scaleX(${Math.min(1, ratio)})` }}
                      />
                      {elapsed > 0 && elapsed < 1 && (
                        <span aria-hidden className="absolute inset-y-0 w-px bg-ink/60" style={{ left: `${elapsed * 100}%` }} />
                      )}
                    </span>
                    <span className="mt-3 flex items-baseline justify-between gap-3 text-[.95rem]">
                      <span>
                        <Money value={b.spent} currency={profile.currency} className="font-semibold" />
                        <span className="text-ink-soft"> of </span>
                        <Money value={b.amount} currency={profile.currency} className="text-ink-soft" />
                      </span>
                      <span className={left < 0 ? "text-accent" : "text-ink-soft"}>
                        <Money value={Math.abs(left)} currency={profile.currency} /> {left < 0 ? "over" : "left"}
                      </span>
                    </span>
                  </EditBudget>
                </li>
              );
            })}
          </ul>
          {isNow && <p className="label">The thin line on each bar is today. Spend left of it means you are ahead of the month.</p>}
        </>
      )}

      {aiEnabled && free.length > 0 && (
        <section aria-labelledby="suggest" className="rounded-[1.2rem_2.4rem_1.2rem_2.4rem] border border-dashed border-ash p-5 sm:p-6">
          <h2 id="suggest" className="mb-1 text-[1.25rem] font-bold tracking-[-0.02em]">
            Not sure where to start?
          </h2>
          <p className="mb-4 max-w-[52ch] text-ink-soft">The assistant can look at your last three months and suggest limits. Nothing is saved until you add one.</p>
          <Suggestions currency={profile.currency} />
        </section>
      )}

      <p className="label">
        <Link href="/assistant?q=Which%20budgets%20am%20I%20likely%20to%20go%20over%20this%20month%2C%20and%20why%3F" className="underline">
          ask the assistant which budgets are at risk →
        </Link>
      </p>
    </div>
  );
}
