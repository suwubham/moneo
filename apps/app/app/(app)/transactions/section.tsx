import Link from "next/link";
import { aiEnabled } from "@/lib/core/config";
import { currentMonth, dayLabel, isMonthKey, monthOf, shiftDays, todayIso } from "@/lib/core/dates";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getPickedBudgets } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { PAGE_SIZE, getTotals, getTransactions } from "@/lib/modules/transactions/service";
import { AccountIcon } from "../../_components/account-icon";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { MonthSwitch } from "../../_components/month-switch";
import { ListSkeleton, Skeleton } from "../../_components/skeleton";
import { btn } from "../../_components/styles";
import { NewAccountButton } from "../accounts/account-drawers";
import { type Group, TransactionsView } from "./transactions-view";

export type Search = {
  month?: string;
  from?: string;
  to?: string;
  account?: string;
  category?: string;
  budget?: string;
  type?: string;
  min?: string;
  max?: string;
  q?: string;
  page?: string;
};

const uuid = /^[0-9a-f-]{36}$/i;

export function readSearch(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const id = (k: string) => (one(k) && uuid.test(one(k)!) ? one(k) : undefined);
  const month = isMonthKey(one("month")) ? one("month")! : currentMonth().key;
  const cat = one("category");
  const category = cat === "none" || (cat && uuid.test(cat)) ? cat : undefined;
  const q = one("q")?.trim().slice(0, 80) || undefined;
  const page = Math.max(1, Math.min(50, Number(one("page")) || 1));
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(one(k) ?? "") && !Number.isNaN(Date.parse(one(k)!)) ? one(k) : undefined);
  const from = date("from");
  const to = date("to");
  // A custom range needs both ends in order; otherwise the month rules.
  const range = from && to && from <= to ? { from, to } : null;
  const type = ["in", "out", "transfer"].includes(one("type") ?? "") ? (one("type") as "in" | "out" | "transfer") : undefined;
  const amount = (k: string) => {
    const n = Number(one(k));
    return one(k) && Number.isFinite(n) && n >= 0 ? String(n) : undefined;
  };
  return { month, range, account: id("account"), category, budget: id("budget"), type, min: amount("min"), max: amount("max"), q, page };
}

export type ReadSearch = ReturnType<typeof readSearch>;

export function link(base: string, s: ReadSearch, patch: Partial<Search>) {
  const p = new URLSearchParams();
  const merged = {
    month: s.range ? undefined : s.month,
    from: s.range?.from,
    to: s.range?.to,
    account: s.account,
    category: s.category,
    budget: s.budget,
    type: s.type,
    min: s.min,
    max: s.max,
    q: s.q,
    ...patch,
  };
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
  return `${base}?${p}`;
}

export function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-12 rounded-full" />
      <Skeleton className="h-9 w-2/3 rounded-full" />
      <ListSkeleton />
    </div>
  );
}

const chip = "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[.78rem] transition-colors duration-300 ease-soft";

// The list of transactions with its month, account chips and filters. `lockAccount` pins it to one account.
export async function TransactionsSection({
  profile,
  s,
  base,
  lockAccount,
  periodAbove = false,
}: {
  profile: { id: string; currency: string };
  s: ReadSearch;
  base: string;
  lockAccount?: string;
  // The page shows its own period picker higher up, so the list skips it.
  periodAbove?: boolean;
}) {
  const month = monthOf(s.month);
  const accountId = lockAccount ?? s.account;
  // The range's last day counts, so the query runs to the day after it.
  const period = s.range ? { from: s.range.from, to: shiftDays(s.range.to, 1) } : { from: month.start, to: month.end };
  const filter = {
    ...period,
    accountId,
    categoryId: s.category,
    budgetId: s.budget,
    direction: s.type,
    minAbs: s.min ? Number(s.min) : undefined,
    maxAbs: s.max ? Number(s.max) : undefined,
    q: s.q,
  };

  const [accounts, categories, budgets, rows, sum] = await Promise.all([
    getAccounts(profile.id),
    getCategories(profile.id),
    getPickedBudgets(profile.id),
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
    // Whole cents, so the day total is exact without float drift.
    const cents = Math.round(Number(r.amount) * 100);
    if (last?.day === r.occurredOn) {
      last.rows.push(r);
      last.cents += cents;
    } else groups.push({ day: r.occurredOn, label: dayLabel(r.occurredOn, today), rows: [r], cents });
  }
  const live = accounts.filter((a) => !a.archivedAt);
  const filtered = Boolean((!lockAccount && s.account) || s.category || s.budget || s.q || s.type || s.min || s.max);
  const here = link(base, s, {});

  const toolbar = (
    <div className="mb-5 flex flex-col gap-4">
      {!lockAccount && live.length > 1 && (
        // Phones scroll the chips sideways, with a fade hinting at more; wider screens wrap them, since a mouse wheel cannot scroll sideways.
        <nav
          aria-label="Accounts"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [mask-image:linear-gradient(to_right,#000_85%,transparent)] [scrollbar-width:none] md:flex-wrap md:overflow-visible md:[mask-image:none]"
        >
          {[{ id: undefined, name: "All accounts", kind: null, icon: null, color: null }, ...live].map((a) => {
            const on = s.account === a.id;
            return (
              <Link
                key={a.id ?? "all"}
                href={link(base, s, { account: a.id, page: undefined })}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={`${chip} ${on ? "border-scene bg-scene text-night" : "border-line bg-night-2 text-ink-soft hover:border-steel hover:text-ink"}`}
              >
                {a.kind && <AccountIcon kind={a.kind} icon={a.icon} color={a.color} size="xs" className="-ml-1.5" />}
                {a.name}
              </Link>
            );
          })}
        </nav>
      )}

      <p className="label flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          {sum.count} transaction{sum.count === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-in" /> in <Money value={sum.moneyIn} currency={profile.currency} className="text-ink" />
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-chart-out" /> out <Money value={sum.moneyOut} currency={profile.currency} className="text-ink" />
        </span>
      </p>
    </div>
  );

  const footer = (
    <>
      {rows.length === 0 && (
        <div className="mt-2">
          <Empty
            title={filtered ? "Nothing matches." : s.range ? "Nothing in these dates." : "A quiet month."}
            body={filtered ? "Try another filter or period." : "No transactions here yet. Add one above, or type it in plain words and let the assistant fill the form."}
          />
        </div>
      )}

      {sum.count > rows.length && (
        <div className="mt-6 text-center">
          <Link href={link(base, s, { page: String(s.page + 1) })} className={btn} scroll={false}>
            show more
          </Link>
        </div>
      )}
    </>
  );

  return (
    <TransactionsView
      groups={groups}
      accounts={live.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }))}
      budgets={budgets}
      currency={profile.currency}
      today={today}
      aiOn={aiEnabled}
      defaultAccount={lockAccount}
      showAccount={!accountId}
      showBalance={Boolean(accountId)}
      filters={{
        base: here,
        values: { q: s.q, category: s.category, budget: s.budget, type: s.type, min: s.min, max: s.max },
        categories: categories.map((c) => ({ id: c.id, name: c.name })),
        budgets,
        period: periodAbove ? null : <MonthSwitch month={s.month} range={s.range} allowRange href={(m) => link(base, s, { month: m, from: undefined, to: undefined })} />,
      }}
      toolbar={toolbar}
      footer={footer}
    />
  );
}
