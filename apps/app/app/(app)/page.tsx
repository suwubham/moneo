import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { aiEnabled } from "@/lib/core/config";
import { currentMonth, dayLabel, monthLabel, todayIso } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getMonthlyFlow, getSpendingByCategory } from "@/lib/modules/reports/service";
import { getTransactions } from "@/lib/modules/transactions/service";
import { Empty } from "../_components/empty";
import { Money } from "../_components/money";
import { PageTitle } from "../_components/page-title";
import { Skeleton } from "../_components/skeleton";
import { btn, tile } from "../_components/styles";
import { NewAccountButton } from "./accounts/account-drawers";
import { MonthRead } from "./month-read";

export const metadata: Metadata = { title: "Overview" };

const big = "text-[clamp(2.4rem,5vw,3.6rem)] leading-none font-extrabold tracking-[-0.045em]";
const mid = "block text-[clamp(1.5rem,2.6vw,2.2rem)] leading-none font-extrabold tracking-[-0.04em]";
const fill = { fine: "bg-steel", close: "bg-amber", over: "bg-accent" } as const;

export default function OverviewPage() {
  return (
    <>
      <PageTitle eyebrow="the month so far" title="Your money," fancy="at a glance." />
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-3.5 lg:grid-cols-12">
      <Skeleton className="col-span-6 h-48 lg:col-span-5" />
      <Skeleton className="col-span-3 h-48 lg:col-span-3" />
      <Skeleton className="col-span-3 h-48 lg:col-span-4" />
      <Skeleton className="col-span-6 h-64 lg:col-span-7" />
      <Skeleton className="col-span-6 h-64 lg:col-span-5" />
    </div>
  );
}

async function Overview() {
  const profile = await requireProfile();
  const cur = profile.currency;
  const month = currentMonth();
  const [accounts, flow, top, budgets, recent] = await Promise.all([
    getAccounts(profile.id),
    getMonthlyFlow(profile.id, month, 6),
    getSpendingByCategory(profile.id, month, 6),
    getBudgetProgress(profile.id, month),
    getTransactions(profile.id, {}, { limit: 6, offset: 0 }),
  ]);

  if (accounts.length === 0) {
    return (
      <Empty title="Let's start with one account." body="Add a bank account, card or cash wallet. Then add a few transactions, and this page fills itself in.">
        <NewAccountButton className={btn} label="Add your first account" />
      </Empty>
    );
  }

  const live = accounts.filter((a) => !a.archivedAt);
  const net = live.reduce((s, a) => s + toNumber(a.balance), 0);
  const now = flow.at(-1)!;
  const before = flow.at(-2)!;
  const monthName = monthLabel(month.key).split(" ")[0].toLowerCase();
  const peak = Math.max(1, ...flow.flatMap((f) => [f.moneyIn, f.moneyOut]));
  const topMax = Math.max(1, ...top.map((t) => toNumber(t.spent)));
  const watch = budgets
    .map((b) => ({ ...b, ...statusOf(b) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  const today = todayIso();

  return (
    <div className="grid grid-flow-row-dense auto-rows-[minmax(10rem,auto)] grid-cols-6 gap-3.5 lg:grid-flow-row lg:grid-cols-12">
      <section className={`${tile} col-span-6 flex flex-col justify-between rounded-[2.4rem_1.2rem_2.4rem_1.2rem] bg-linear-to-br from-crimson/30 to-night-2 lg:col-span-5`}>
        <span aria-hidden className="blob blob-e -top-28 -right-28 w-80 opacity-35 blur-xl" />
        <h2 className="label">net worth · {live.length} account{live.length === 1 ? "" : "s"}</h2>
        <div>
          <Money value={net} currency={cur} className={`${big} block`} />
          <Link href="/accounts" className="label mt-3 inline-block underline">
            see accounts
          </Link>
        </div>
      </section>

      <section className={`${tile} col-span-3 flex flex-col justify-between lg:col-span-3`}>
        <h2 className="label">money in · {monthName}</h2>
        <div>
          <Money value={now.moneyIn} currency={cur} className={`${mid} text-steel`} />
          <p className="label mt-2">
            last month <Money value={before.moneyIn} currency={cur} className="text-ink" />
          </p>
        </div>
      </section>

      <section className={`${tile} col-span-3 flex flex-col justify-between rounded-[1.2rem_2.4rem_1.2rem_2.4rem] lg:col-span-4`}>
        <h2 className="label">money out · {monthName}</h2>
        <div>
          <Money value={now.moneyOut} currency={cur} className={mid} />
          <p className="label mt-2">
            last month <Money value={before.moneyOut} currency={cur} className="text-ink" /> · net{" "}
            <Money value={now.moneyIn - now.moneyOut} currency={cur} sign className="text-ink" />
          </p>
        </div>
      </section>

      <section className={`${tile} col-span-6 flex flex-col gap-5 lg:col-span-7`} aria-labelledby="flow">
        <h2 id="flow" className="label">
          six months · in and out
        </h2>
        <div className="flex flex-1 items-end gap-2 sm:gap-4" role="list">
          {flow.map((f) => (
            <div key={f.month} role="listitem" className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1">
                <span
                  className="w-full max-w-5 origin-bottom rounded-t-md bg-steel"
                  style={{ height: "100%", transform: `scaleY(${f.moneyIn / peak})` }}
                  title={`In ${f.moneyIn}`}
                />
                <span
                  className="w-full max-w-5 origin-bottom rounded-t-md bg-amber"
                  style={{ height: "100%", transform: `scaleY(${f.moneyOut / peak})` }}
                  title={`Out ${f.moneyOut}`}
                />
              </div>
              <span className="label text-[.7rem]">{monthLabel(f.month).slice(0, 3).toLowerCase()}</span>
              <span className="sr-only">
                in <Money value={f.moneyIn} currency={cur} />, out <Money value={f.moneyOut} currency={cur} />
              </span>
            </div>
          ))}
        </div>
        <p className="label flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-steel" /> in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber" /> out
          </span>
        </p>
      </section>

      {aiEnabled ? (
        <section className={`${tile} col-span-6 flex flex-col gap-4 rounded-[1.2rem_2.4rem_1.2rem_2.4rem] lg:col-span-5`} aria-labelledby="read">
          <h2 id="read" className="label">
            the assistant&apos;s read
          </h2>
          <MonthRead />
        </section>
      ) : (
        <section className={`${tile} col-span-6 flex flex-col justify-between border-dashed border-ash lg:col-span-5`}>
          <h2 className="label">the assistant</h2>
          <p className="text-ink-soft">Switched off. Set GOOGLE_CLOUD_PROJECT to get a plain-words read of your month here.</p>
        </section>
      )}

      <section className={`${tile} col-span-6 flex flex-col gap-4 lg:col-span-5`} aria-labelledby="top">
        <h2 id="top" className="label">
          where it went this month
        </h2>
        {top.length === 0 ? (
          <p className="text-ink-soft">No spending yet this month.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {top.map((t) => (
              <li key={t.categoryId ?? "none"}>
                <div className="flex items-baseline justify-between gap-3 text-[.95rem]">
                  <span className="truncate">{t.name}</span>
                  <Money value={t.spent} currency={cur} className="font-semibold" />
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-night">
                  <div className="h-full origin-left rounded-full bg-scene" style={{ transform: `scaleX(${toNumber(t.spent) / topMax})` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/transactions" className="label mt-auto underline">
          see the transactions
        </Link>
      </section>

      <section className={`${tile} col-span-6 flex flex-col gap-4 lg:col-span-3`} aria-labelledby="budgets">
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
          <ul className="flex flex-col gap-3.5">
            {watch.map((b) => (
              <li key={b.id}>
                <div className="flex justify-between gap-2 text-[.92rem]">
                  <span className="truncate">{b.categoryName}</span>
                  <span className="tabular-nums text-ink-soft">{Math.round(b.ratio * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-night">
                  <div className={`h-full origin-left rounded-full ${fill[b.status]}`} style={{ transform: `scaleX(${Math.min(1, b.ratio)})` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {watch.length > 0 && (
          <Link href="/budgets" className="label mt-auto underline">
            all budgets
          </Link>
        )}
      </section>

      <section className={`${tile} col-span-6 flex flex-col gap-3 lg:col-span-4`} aria-labelledby="recent">
        <h2 id="recent" className="label">
          latest
        </h2>
        {recent.length === 0 ? (
          <p className="text-ink-soft">
            No transactions yet.{" "}
            <Link href="/transactions" className="underline">
              Add the first
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[.95rem] font-semibold">{t.description}</span>
                  <span className="label block">{dayLabel(t.occurredOn, today)}</span>
                </span>
                <Money value={t.amount} currency={cur} sign={toNumber(t.amount) > 0} tone />
              </li>
            ))}
          </ul>
        )}
        <Link href="/transactions" className="label mt-auto underline">
          all transactions
        </Link>
      </section>
    </div>
  );
}
