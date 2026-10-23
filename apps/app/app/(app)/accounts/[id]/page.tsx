import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireProfile } from "@/lib/core/auth";
import { dayLabel, monthLabel, monthOf, shiftDays, todayIso } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { isOwed, kindLabels } from "@/lib/modules/accounts/constants";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBalanceHistory } from "@/lib/modules/reports/service";
import { getTotals } from "@/lib/modules/transactions/service";
import { AccountIcon } from "../../../_components/account-icon";
import { BalanceChart } from "../../../_components/charts";
import { CountUp } from "../../../_components/count-up";
import { Empty } from "../../../_components/empty";
import { AccountBalance, Money } from "../../../_components/money";
import { Reveal } from "../../../_components/reveal";
import { Skeleton } from "../../../_components/skeleton";
import { badge, btn, tile } from "../../../_components/styles";
import { MonthSwitch } from "../../../_components/month-switch";
import { TransactionsLoading, TransactionsSection, link, readSearch } from "../../transactions/section";
import { EditAccountButton } from "../account-drawers";

export const metadata: Metadata = { title: "Account" };

const uuid = /^[0-9a-f-]{36}$/i;

export default function AccountPage({ params, searchParams }: PageProps<"/accounts/[id]">) {
  return (
    <>
      <Link href="/accounts" className="label mb-5 inline-flex items-center gap-1.5 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> all accounts
      </Link>
      <Reveal
        fallback={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-72" />
            <TransactionsLoading />
          </div>
        }
      >
        <Account params={params} searchParams={searchParams} />
      </Reveal>
    </>
  );
}

async function Account({ params, searchParams }: Pick<PageProps<"/accounts/[id]">, "params" | "searchParams">) {
  const profile = await requireProfile();
  const { id } = await params;
  const accounts = uuid.test(id) ? await getAccounts(profile.id) : [];
  const account = accounts.find((a) => a.id === id);
  if (!account) {
    return (
      <Empty title="That account is gone." body="It may have been deleted. Your other accounts are still where you left them.">
        <Link href="/accounts" className={btn}>
          back to accounts
        </Link>
      </Empty>
    );
  }

  const s = readSearch(await searchParams);
  const today = todayIso();
  // The page's period, as the transactions below use it: a month, or custom dates (last day included).
  const month = monthOf(s.month);
  const from = s.range?.from ?? month.start;
  const last = s.range?.to ?? shiftDays(month.end, -1);
  const end = last < today ? last : today;
  const days = from <= end ? Math.round((Date.parse(end) - Date.parse(from)) / 86_400_000) + 1 : 0;
  const [series, sum] = await Promise.all([
    // One extra day in front: its closing balance is what the period opens with.
    days > 0 ? getBalanceHistory(profile.id, [id], end, days + 1).then((m) => m.get(id) ?? []) : Promise.resolve([]),
    getTotals(profile.id, { accountId: id, from, to: shiftDays(last, 1) }),
  ]);
  const startBal = series.length ? series[0].balance : null;
  const endBal = series.at(-1)?.balance ?? null;
  const net = toNumber(sum.moneyIn) - toNumber(sum.moneyOut);
  const periodLabel = s.range ? `${dayLabel(s.range.from, today)} – ${dayLabel(s.range.to, today)}` : monthLabel(s.month);

  // The balance where the period ends leads; for a card or loan that is what you owe.
  const owed = isOwed(account.kind);
  const lead = endBal == null ? null : owed ? -endBal : endBal;
  const leadNote = owed && endBal != null ? (endBal < 0 ? "owed" : endBal > 0 ? "in credit" : "nothing owed") : null;
  const stats: [string, React.ReactNode][] = [
    [`start of period`, startBal == null ? "—" : <Money value={startBal} currency={profile.currency} />],
    ["money in", <Money key="in" value={sum.moneyIn} currency={profile.currency} />],
    ["money out", <Money key="out" value={sum.moneyOut} currency={profile.currency} />],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="rise-1 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <AccountIcon kind={account.kind} icon={account.icon} color={account.color} size="lg" />
          <div>
            <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] leading-none font-extrabold tracking-[-0.045em]">{account.name}</h1>
            <p className="mt-1.5 flex items-center gap-2">
              <span className={badge}>{kindLabels[account.kind]}</span>
              {account.archivedAt && <span className={badge}>archived</span>}
              <span className="label">
                today <AccountBalance kind={account.kind} balance={account.balance} currency={profile.currency} className="text-ink" />
              </span>
            </p>
          </div>
        </div>
        <EditAccountButton
          account={{
            id: account.id,
            name: account.name,
            kind: account.kind,
            openingBalance: account.openingBalance,
            archived: Boolean(account.archivedAt),
            icon: account.icon,
            color: account.color,
          }}
          className={btn}
        >
          <Pencil className="size-3.5" aria-hidden /> edit
        </EditAccountButton>
      </header>

      {/* Outside the chart tile: the tile clips its blob, and the calendar must not be clipped with it. */}
      <div className="relative z-20 -mb-2">
        <MonthSwitch month={s.month} range={s.range} allowRange href={(m) => link(`/accounts/${id}`, s, { month: m, from: undefined, to: undefined })} />
      </div>

      <section className={`${tile} rise-1 flex flex-col gap-5 rounded-[2.4rem_1.2rem_2.4rem_1.2rem]`} aria-labelledby="period">
        <span aria-hidden className="blob blob-a -top-32 -right-32 w-96 opacity-15 blur-2xl" />
        <h2 id="period" className="label">
          balance · {periodLabel}
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="label">{end === today ? "today" : "end of period"}</p>
            {lead == null ? (
              <p className="mt-1 text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-extrabold tracking-[-0.045em]">—</p>
            ) : (
              <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <CountUp value={lead} currency={profile.currency} className="text-[clamp(2.2rem,5vw,3.4rem)] leading-none font-extrabold tracking-[-0.045em]" />
                {leadNote && <span className="label">{leadNote}</span>}
              </p>
            )}
          </div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-night/60 px-3.5 py-1.5">
            <span className="label">change</span>
            <Money value={net} currency={profile.currency} sign tone className="font-bold" />
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-4 border-t border-line pt-4">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="label">{k}</dt>
              <dd className="mt-1 truncate text-[clamp(1rem,1.8vw,1.25rem)] font-extrabold tracking-[-0.03em]">{v}</dd>
            </div>
          ))}
        </dl>
        {series.length > 1 ? (
          <BalanceChart
            data={series.map((p, i) => ({ date: p.date, label: i === 0 ? "start" : dayLabel(p.date, today), balance: p.balance }))}
            currency={profile.currency}
          />
        ) : (
          <p className="text-ink-soft">{days === 0 ? "This period has not started yet." : "One day is too short for a chart. Pick a longer period below."}</p>
        )}
      </section>

      <TransactionsSection profile={{ id: profile.id, currency: profile.currency }} s={s} base={`/accounts/${id}`} lockAccount={id} periodAbove />
    </div>
  );
}
