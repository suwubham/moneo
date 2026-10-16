import type { Metadata } from "next";
import Link from "next/link";
import { aiEnabled } from "@/lib/core/config";
import { requireProfile } from "@/lib/core/auth";
import { currentMonth, daysInMonth, isMonthKey, monthOf, todayIso } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { Flag, Wallet } from "lucide-react";
import { getBudgetHistory, getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { CategoryIcon } from "../../_components/category-icon";
import { MiniColumns } from "../../_components/charts";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { MonthSwitch } from "../../_components/month-switch";
import { PageTitle } from "../../_components/page-title";
import { Reveal } from "../../_components/reveal";
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
      <Reveal fallback={<ListSkeleton rows={4} />}>
        <Budgets searchParams={searchParams} />
      </Reveal>
    </>
  );
}

async function Budgets({ searchParams }: { searchParams: PageProps<"/budgets">["searchParams"] }) {
  // Read the session before the clock: Cache Components rejects new Date() ahead of request data.
  const profile = await requireProfile();
  const sp = await searchParams;
  const key = isMonthKey(sp.month) ? sp.month : currentMonth().key;
  const month = monthOf(key);
  const [budgets, categories, historyOf] = await Promise.all([
    getBudgetProgress(profile.id, month),
    getCategories(profile.id),
    getBudgetHistory(profile.id, month, 6),
  ]);

  const expense = categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name }));
  const free = expense.filter((c) => !budgets.some((b) => b.categoryId === c.id));
  const canTotal = !budgets.some((b) => b.kind === "total");
  // Only category budgets add up: the total and picked ones overlap with them.
  const perCategory = budgets.filter((b) => b.kind === "category");
  const limit = perCategory.reduce((s, b) => s + toNumber(b.amount), 0);
  const spent = perCategory.reduce((s, b) => s + toNumber(b.spent), 0);

  // How far through the month we are, so a bar can be read against time, not only against the limit.
  const today = todayIso();
  const isNow = key === currentMonth().key;
  const elapsed = isNow ? Number(today.slice(8, 10)) / daysInMonth(key) : key < currentMonth().key ? 1 : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthSwitch month={key} href={(m) => `/budgets?month=${m}`} />
        <NewBudgetButton categories={free} canTotal={canTotal} className={btnPrimary} />
      </div>

      {budgets.length === 0 ? (
        <Empty
          title="No budgets yet."
          body="Set a monthly limit for one category, for all spending, or for only the transactions you add to it. Moneo shows how close you are as the month goes on."
        />
      ) : (
        <>
          {perCategory.length > 1 && (
            <p className="label">
              <Money value={spent} currency={profile.currency} className="text-ink" /> of{" "}
              <Money value={limit} currency={profile.currency} className="text-ink" /> across {perCategory.length} category budgets
            </p>
          )}
          <ul className="rise grid gap-3.5 md:grid-cols-2">
            {budgets.map((b, i) => {
              const { ratio, status } = statusOf(b);
              const left = toNumber(b.amount) - toNumber(b.spent);
              const history = historyOf(b.id);
              const txHref =
                b.kind === "picked"
                  ? `/transactions?month=${key}&budget=${b.id}`
                  : b.kind === "category"
                    ? `/transactions?month=${key}&category=${b.categoryId}`
                    : `/transactions?month=${key}`;
              return (
                <li key={b.id} style={{ "--i": i } as React.CSSProperties}>
                  <EditBudget
                    budget={{ id: b.id, kind: b.kind, name: b.name, amount: b.amount }}
                    month={key}
                    history={history}
                    txHref={txHref}
                    currency={profile.currency}
                    className={`${card} block w-full p-5 text-left transition-[translate,border-color] duration-300 ease-soft hover:-translate-y-0.5 hover:border-steel`}
                  >
                    <span className="flex items-center gap-3">
                      {b.kind === "category" ? (
                        <CategoryIcon category={b} />
                      ) : (
                        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-night-3 text-scene">
                          {b.kind === "total" ? <Wallet className="size-[1.15rem]" /> : <Flag className="size-[1.15rem]" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[1.15rem] font-bold">{b.name}</span>
                        <span className="label block truncate">{b.kind === "total" ? "every category" : b.kind === "picked" ? "transactions you add" : "category"}</span>
                      </span>
                      <span className={`label shrink-0 ${wordTone[status]}`}>{words[status]}</span>
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
                    <span className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[.95rem]">
                      <span>
                        <Money value={b.spent} currency={profile.currency} className="font-semibold" />
                        <span className="text-ink-soft"> of </span>
                        <Money value={b.amount} currency={profile.currency} className="text-ink-soft" />
                      </span>
                      <span className={left < 0 ? "text-accent" : "text-ink-soft"}>
                        <Money value={Math.abs(left)} currency={profile.currency} /> {left < 0 ? "over" : "left"}
                      </span>
                    </span>
                    <span className="mt-4 block border-t border-line pt-3">
                      <span className="label mb-1 block">last six months · the line is the limit</span>
                      <MiniColumns
                        data={history.map((h) => ({ key: h.key, label: h.label, value: h.spent }))}
                        active={key}
                        color="var(--chart-in)"
                        name="spent"
                        currency={profile.currency}
                        limit={toNumber(b.amount)}
                        height={64}
                      />
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
