import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { requireProfile } from "@/lib/core/auth";
import { aiEnabled } from "@/lib/core/config";
import { currentMonth, isMonthKey, monthLabel, monthOf, todayIso } from "@/lib/core/dates";
import { formatMoney, toNumber } from "@/lib/core/money";
import { balanceSplit } from "@/lib/modules/accounts/constants";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetHistory, getBudgetProgress, getPickedBudgets, statusOf } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { getBalanceHistory, getMonthlyFlow, getSpendingByCategory, getSpendingPace } from "@/lib/modules/reports/service";
import { getTransactions } from "@/lib/modules/transactions/service";
import { CategoryIcon } from "../_components/category-icon";
import { FlowChart, MiniColumns, MiniTrend, PaceChart } from "../_components/charts";
import { CountUp } from "../_components/count-up";
import { Empty } from "../_components/empty";
import { HaveOwe, Money } from "../_components/money";
import { MonthSwitch } from "../_components/month-switch";
import { PageTitle } from "../_components/page-title";
import { Reveal } from "../_components/reveal";
import { Skeleton } from "../_components/skeleton";
import { btn, tile } from "../_components/styles";
import { NewAccountButton } from "./accounts/account-drawers";
import { BudgetPeek } from "./budget-peek";
import { MonthRead } from "./month-read";
import { RecentList } from "./recent-list";

export const metadata: Metadata = { title: "Overview" };

const big = "text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-extrabold tracking-[-0.045em]";
const mid = "block text-[clamp(1.25rem,2.4vw,2rem)] leading-none font-extrabold tracking-[-0.04em]";
const fill = { fine: "bg-steel", close: "bg-amber", over: "bg-accent" } as const;
const more = "label mt-auto inline-flex items-center gap-1.5 underline-offset-4 hover:underline";

export default function OverviewPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageTitle eyebrow="the month so far" title="Your money," fancy="at a glance." />
      <Reveal fallback={<OverviewSkeleton />}>
        <Overview searchParams={searchParams} />
      </Reveal>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-3.5 lg:grid-cols-12">
      <Skeleton className="col-span-6 h-9 w-72 lg:col-span-12" />
      <Skeleton className="col-span-6 h-40 lg:col-span-6" />
      <Skeleton className="col-span-3 h-40 lg:col-span-3" />
      <Skeleton className="col-span-3 h-40 lg:col-span-3" />
      <Skeleton className="col-span-6 h-72 lg:col-span-7" />
      <Skeleton className="col-span-6 h-72 lg:col-span-5" />
    </div>
  );
}

// Percent change against last month, or null when there is nothing to compare with.
function change(now: number, before: number) {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

function Delta({ pct, upIsGood }: { pct: number | null; upIsGood: boolean }) {
  if (pct == null || pct === 0) return null;
  const up = pct > 0;
  const good = up === upIsGood;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[.72rem] ${good ? "border-steel/50 text-steel" : "border-amber/50 text-amber"}`}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {pct}%<span className="sr-only"> against last month</span>
    </span>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Read the session before the clock: Cache Components rejects new Date() ahead of request data.
  const profile = await requireProfile();
  const sp = await searchParams;
  const cur = profile.currency;
  const key = isMonthKey(sp.month) ? sp.month : currentMonth().key;
  const month = monthOf(key);
  const isNow = key === currentMonth().key;
  const today = todayIso();

  const [accounts, flow, top, budgets, recent, pace, historyOf, categories, picked] = await Promise.all([
    getAccounts(profile.id),
    getMonthlyFlow(profile.id, month, 6),
    getSpendingByCategory(profile.id, month, 6),
    getBudgetProgress(profile.id, month),
    getTransactions(profile.id, { from: month.start, to: month.end }, { limit: 6, offset: 0 }),
    getSpendingPace(profile.id, month, today),
    getBudgetHistory(profile.id, month, 6),
    getCategories(profile.id),
    getPickedBudgets(profile.id),
  ]);

  if (accounts.length === 0) {
    return (
      <Empty title="Let's start with one account." body="Add a bank account, card or cash wallet. Then add a few transactions, and this page fills itself in.">
        <NewAccountButton className={btn} label="Add your first account" />
      </Empty>
    );
  }

  const live = accounts.filter((a) => !a.archivedAt);
  const history = await getBalanceHistory(profile.id, live.map((a) => a.id), today, 90);
  const dates = [...history.values()][0]?.map((p) => p.date) ?? [];
  const netSeries = dates.map((date, i) => ({
    key: date,
    label: date === today ? "today" : shortDate(date),
    value: Math.round([...history.values()].reduce((s, series) => s + (series[i]?.balance ?? 0), 0) * 100) / 100,
  }));
  const split = balanceSplit(live);
  const now = flow.at(-1)!;
  const before = flow.at(-2)!;
  const monthName = monthLabel(key).split(" ")[0].toLowerCase();
  const prevName = monthLabel(flow.at(-2)!.month).split(" ")[0].toLowerCase();
  const spentTotal = top.reduce((s, t) => s + toNumber(t.spent), 0);
  const topMax = Math.max(1, ...top.map((t) => toNumber(t.spent)));
  const watch = budgets
    .map((b) => ({ ...b, ...statusOf(b) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  const href = (m: string) => (m === currentMonth().key ? "/" : `/?month=${m}`);
  const txHref = `/transactions?month=${key}`;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <MonthSwitch month={key} href={href} />
        {!isNow && <p className="label">looking back at {monthLabel(key)}</p>}
      </div>

      <div className="rise grid grid-cols-6 gap-3.5 lg:grid-cols-12">
        <section style={{ "--i": 0 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col justify-between gap-6 rounded-[2.4rem_1.2rem_2.4rem_1.2rem] bg-linear-to-br from-crimson/30 to-night-2 lg:col-span-6`}>
          <span aria-hidden className="blob blob-e -top-28 -right-28 w-80 opacity-35 blur-xl" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="label">net worth · {live.length} account{live.length === 1 ? "" : "s"}</h2>
            <Link href="/accounts" className="label inline-flex items-center gap-1 hover:text-ink">
              accounts <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CountUp value={split.net} currency={cur} className={`${big} block`} />
              <HaveOwe split={split} currency={cur} className="mt-2 block" />
            </div>
            <div className="w-full sm:w-64">
              <MiniTrend data={netSeries} name="net worth" currency={cur} />
            </div>
          </div>
        </section>

        {/* The whole tile opens this month's money in. Hover changes colour only: the rise animation owns transform. */}
        <Link
          href={`${txHref}&type=in`}
          style={{ "--i": 1 } as React.CSSProperties}
          className={`${tile} group col-span-3 flex min-w-0 flex-col justify-between gap-4 transition-colors duration-300 ease-soft hover:border-steel lg:col-span-3`}
        >
          <h2 className="label flex items-center justify-between gap-2">
            money in · {monthName}
            <ArrowRight className="size-3.5 shrink-0 transition-colors duration-300 ease-soft group-hover:text-ink" aria-hidden />
          </h2>
          <MiniColumns
            data={flow.map((f) => ({ key: f.month, label: monthLabel(f.month).slice(0, 3).toLowerCase(), value: f.moneyIn }))}
            active={key}
            color="var(--chart-in)"
            name="money in"
            currency={cur}
          />
          <div className="min-w-0">
            <CountUp value={now.moneyIn} currency={cur} compact className={`${mid} truncate sm:hidden`} />
            <CountUp value={now.moneyIn} currency={cur} className={`${mid} hidden truncate sm:block`} />
            <p className="label mt-2 flex flex-wrap items-center gap-2">
              <Delta pct={change(now.moneyIn, before.moneyIn)} upIsGood />
              <span className="truncate">
                {prevName} {formatMoney(before.moneyIn, cur, { compact: true })}
              </span>
            </p>
          </div>
        </Link>

        {/* The whole tile opens this month's money out. Hover changes colour only: the rise animation owns transform. */}
        <Link
          href={`${txHref}&type=out`}
          style={{ "--i": 2 } as React.CSSProperties}
          className={`${tile} group col-span-3 flex min-w-0 flex-col justify-between gap-4 rounded-[1.2rem_2.4rem_1.2rem_2.4rem] transition-colors duration-300 ease-soft hover:border-steel lg:col-span-3`}
        >
          <h2 className="label flex items-center justify-between gap-2">
            money out · {monthName}
            <ArrowRight className="size-3.5 shrink-0 transition-colors duration-300 ease-soft group-hover:text-ink" aria-hidden />
          </h2>
          <MiniColumns
            data={flow.map((f) => ({ key: f.month, label: monthLabel(f.month).slice(0, 3).toLowerCase(), value: f.moneyOut }))}
            active={key}
            color="var(--chart-out)"
            name="money out"
            currency={cur}
          />
          <div className="min-w-0">
            <CountUp value={now.moneyOut} currency={cur} compact className={`${mid} truncate sm:hidden`} />
            <CountUp value={now.moneyOut} currency={cur} className={`${mid} hidden truncate sm:block`} />
            <p className="label mt-2 flex flex-wrap items-center gap-2">
              <Delta pct={change(now.moneyOut, before.moneyOut)} upIsGood={false} />
              <span className="truncate">
                net {formatMoney(now.moneyIn - now.moneyOut, cur, { sign: true, compact: true })}
              </span>
            </p>
          </div>
        </Link>

        <section style={{ "--i": 3 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-4 lg:col-span-7`} aria-labelledby="flow">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="flow" className="label">
              six months · in and out
            </h2>
            <span className="label hidden sm:inline">tap a month to open it</span>
          </div>
          <FlowChart
            data={flow.map((f) => ({ key: f.month, label: monthLabel(f.month).slice(0, 3).toLowerCase(), moneyIn: f.moneyIn, moneyOut: f.moneyOut, href: href(f.month) }))}
            currency={cur}
            active={key}
          />
        </section>

        <section style={{ "--i": 4 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-4 rounded-[1.2rem_2.4rem_1.2rem_2.4rem] lg:col-span-5`} aria-labelledby="pace">
          <h2 id="pace" className="label">
            spending pace · day by day
          </h2>
          <PaceChart data={pace} currency={cur} labels={{ now: monthName, before: prevName }} />
        </section>

        {aiEnabled && (
          <section style={{ "--i": 5 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-3 border-dashed border-ash sm:flex-row sm:items-center lg:col-span-12`} aria-labelledby="read">
            <h2 id="read" className="label flex shrink-0 items-center gap-2 sm:w-44">
              <Sparkles className="size-4 text-scene" aria-hidden /> the assistant&apos;s read
            </h2>
            <MonthRead />
          </section>
        )}

        <section style={{ "--i": 6 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-4 lg:col-span-5`} aria-labelledby="top">
          <h2 id="top" className="label">
            where it went · {monthName}
          </h2>
          {top.length === 0 ? (
            <p className="text-ink-soft">No spending in {monthName} yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {top.map((t) => (
                <li key={t.categoryId ?? "none"}>
                  <Link
                    href={`${txHref}&category=${t.categoryId ?? "none"}`}
                    className="wash -mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5"
                  >
                    <CategoryIcon category={t.categoryId ? t : null} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3 text-[.95rem]">
                        <span className="truncate">{t.name}</span>
                        <span className="shrink-0">
                          <Money value={t.spent} currency={cur} className="font-semibold" />
                          <span className="label ml-2 inline-block w-9 text-right">{Math.round((toNumber(t.spent) / Math.max(1, spentTotal)) * 100)}%</span>
                        </span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-night">
                        <span
                          className="grow-x block h-full origin-left rounded-full bg-chart-out transition-transform duration-700 ease-snap"
                          style={{ transform: `scaleX(${toNumber(t.spent) / topMax})` }}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={txHref} className={more}>
            all of {monthName} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>

        <section style={{ "--i": 7 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-4 lg:col-span-3`} aria-labelledby="budgets">
          <h2 id="budgets" className="label">
            budgets to watch
          </h2>
          {watch.length === 0 ? (
            <p className="text-ink-soft">
              None set.{" "}
              <Link href="/budgets" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {watch.map((b) => (
                <li key={b.id}>
                  <BudgetPeek
                    budget={{ id: b.id, name: b.name, kind: b.kind, categoryId: b.categoryId, amount: b.amount }}
                    history={historyOf(b.id)}
                    currency={cur}
                    className="wash -mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-1.5 text-left"
                  >
                    <span className="flex items-center justify-between gap-2 text-[.92rem]">
                      <span className="truncate">{b.name}</span>
                      <span className={`tabular-nums ${b.status === "over" ? "text-accent" : "text-ink-soft"}`}>{Math.round(b.ratio * 100)}%</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-night">
                      <span className={`grow-x block h-full origin-left rounded-full ${fill[b.status]} transition-transform duration-700 ease-snap`} style={{ transform: `scaleX(${Math.min(1, b.ratio)})` }} />
                    </span>
                  </BudgetPeek>
                </li>
              ))}
            </ul>
          )}
          {watch.length > 0 && (
            <Link href={key === currentMonth().key ? "/budgets" : `/budgets?month=${key}`} className={more}>
              all budgets <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </section>

        <section style={{ "--i": 8 } as React.CSSProperties} className={`${tile} col-span-6 flex flex-col gap-3 lg:col-span-4`} aria-labelledby="recent">
          <h2 id="recent" className="label">
            latest · {monthName}
          </h2>
          {recent.length === 0 ? (
            <p className="text-ink-soft">
              Nothing in {monthName}.{" "}
              <Link href="/transactions" className="underline">
                Add a transaction
              </Link>
              .
            </p>
          ) : (
            <RecentList
              rows={recent}
              accounts={live.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance }))}
              categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }))}
              budgets={picked}
              currency={cur}
              today={today}
            />
          )}
          <Link href={txHref} className={more}>
            all transactions <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  );
}
