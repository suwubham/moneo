import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { aiEnabled } from "@/lib/core/config";
import { requireProfile } from "@/lib/core/auth";
import { currentMonth, dayLabel, isMonthKey, monthOf, todayIso } from "@/lib/core/dates";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getCategories } from "@/lib/modules/categories/service";
import { PAGE_SIZE, getTotals, getTransactions } from "@/lib/modules/transactions/service";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { MonthSwitch } from "../../_components/month-switch";
import { PageTitle } from "../../_components/page-title";
import { ListSkeleton, Skeleton } from "../../_components/skeleton";
import { btn, controlSm } from "../../_components/styles";
import { NewAccountButton } from "../accounts/account-drawers";
import { type Group, TransactionsView } from "./transactions-view";

export const metadata: Metadata = { title: "Transactions" };

type Search = { month?: string; account?: string; category?: string; q?: string; page?: string };

const uuid = /^[0-9a-f-]{36}$/i;

function readSearch(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const month = isMonthKey(one("month")) ? one("month")! : currentMonth().key;
  const account = one("account") && uuid.test(one("account")!) ? one("account") : undefined;
  const cat = one("category");
  const category = cat === "none" || (cat && uuid.test(cat)) ? cat : undefined;
  const q = one("q")?.trim().slice(0, 80) || undefined;
  const page = Math.max(1, Math.min(50, Number(one("page")) || 1));
  return { month, account, category, q, page };
}

function link(s: ReturnType<typeof readSearch>, patch: Partial<Search>) {
  const p = new URLSearchParams();
  const merged = { month: s.month, account: s.account, category: s.category, q: s.q, ...patch };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
  return `/transactions?${p}`;
}

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <>
      <PageTitle eyebrow="money in, money out" title="Every" fancy="transaction." />
      <Suspense fallback={<Loading />}>
        <Transactions searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-14 rounded-full" />
      <ListSkeleton />
    </div>
  );
}

async function Transactions({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  // Read the session before the clock: Cache Components rejects new Date() ahead of request data.
  const profile = await requireProfile();
  const s = readSearch(await searchParams);
  const month = monthOf(s.month);
  const filter = { from: month.start, to: month.end, accountId: s.account, categoryId: s.category, q: s.q };

  const [accounts, categories, rows, sum] = await Promise.all([
    getAccounts(profile.id),
    getCategories(profile.id),
    getTransactions(profile.id, filter, { limit: PAGE_SIZE * s.page, offset: 0 }),
    getTotals(profile.id, filter),
  ]);

  if (accounts.length === 0) {
    return (
      <Empty title="First, an account." body="Transactions belong to an account. Add one (a bank account, a card, your wallet), then come back here.">
        <NewAccountButton className={btn} label="Add an account" />
      </Empty>
    );
  }

  const today = todayIso();
  const groups: Group[] = [];
  for (const r of rows) {
    const last = groups.at(-1);
    if (last?.day === r.occurredOn) last.rows.push(r);
    else groups.push({ day: r.occurredOn, label: dayLabel(r.occurredOn, today), rows: [r] });
  }
  const live = accounts.filter((a) => !a.archivedAt);
  const filtered = Boolean(s.account || s.category || s.q);

  const toolbar = (
    <>
      <div className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <MonthSwitch month={s.month} href={(m) => link(s, { month: m })} />
        <Form action="/transactions" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={s.month} />
          <label className="sr-only" htmlFor="f-q">
            Search descriptions
          </label>
          <input id="f-q" name="q" defaultValue={s.q} placeholder="search" className={`${controlSm} w-full sm:w-44`} />
          <label className="sr-only" htmlFor="f-account">
            Account
          </label>
          <select id="f-account" name="account" defaultValue={s.account ?? ""} className={`${controlSm} min-w-0 flex-1 sm:flex-none`}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-category">
            Category
          </label>
          <select id="f-category" name="category" defaultValue={s.category ?? ""} className={`${controlSm} min-w-0 flex-1 sm:flex-none`}>
            <option value="">All categories</option>
            <option value="none">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className={`${btn} h-9`}>
            filter
          </button>
          {filtered && (
            <Link href={link(s, { account: undefined, category: undefined, q: undefined })} className="label underline">
              clear
            </Link>
          )}
        </Form>
      </div>

      <p className="label -mt-3 mb-6">
        {sum.count} transaction{sum.count === 1 ? "" : "s"} · in <Money value={sum.moneyIn} currency={profile.currency} className="text-steel" /> · out{" "}
        <Money value={sum.moneyOut} currency={profile.currency} className="text-ink" />
      </p>
    </>
  );

  const footer = (
    <>
      {rows.length === 0 && (
        <div className="mt-6">
          <Empty
            title={filtered ? "Nothing matches." : "A quiet month."}
            body={filtered ? "Try another filter or month." : "No transactions in this month yet. Add one above, or type it in plain words and let the assistant fill the form."}
          />
        </div>
      )}

      {sum.count > rows.length && (
        <div className="mt-6 text-center">
          <Link href={link(s, { page: String(s.page + 1) })} className={btn} scroll={false}>
            show more
          </Link>
        </div>
      )}
    </>
  );

  return (
    <TransactionsView
      groups={groups}
      accounts={live.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      currency={profile.currency}
      today={today}
      aiOn={aiEnabled}
      toolbar={toolbar}
      footer={footer}
    />
  );
}
