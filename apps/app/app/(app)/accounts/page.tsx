import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireProfile } from "@/lib/core/auth";
import { todayIso } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { kindLabels } from "@/lib/modules/accounts/constants";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBalanceHistory } from "@/lib/modules/reports/service";
import { AccountIcon } from "../../_components/account-icon";
import { MiniTrend } from "../../_components/charts";
import { CountUp } from "../../_components/count-up";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { PageTitle } from "../../_components/page-title";
import { Reveal } from "../../_components/reveal";
import { Skeleton } from "../../_components/skeleton";
import { badge, btn, btnPrimary } from "../../_components/styles";
import { EditAccountButton, NewAccountButton } from "./account-drawers";

export const metadata: Metadata = { title: "Accounts" };

const shapes = ["rounded-[2.4rem_1.2rem_2.4rem_1.2rem]", "rounded-[1.2rem_2.4rem_1.2rem_2.4rem]", "rounded-[1.1rem]"];
const editBtn =
  "absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full border border-line bg-night-3 text-ink-soft transition-colors duration-300 ease-soft hover:border-steel hover:text-ink";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });

export default function AccountsPage() {
  return (
    <>
      <PageTitle eyebrow="where it lives" title="Your" fancy="accounts.">
        <NewAccountButton className={btnPrimary} />
      </PageTitle>
      <Reveal fallback={<AccountsSkeleton />}>
        <Accounts />
      </Reveal>
    </>
  );
}

function AccountsSkeleton() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-52" />
      ))}
    </div>
  );
}

async function Accounts() {
  const profile = await requireProfile();
  const accounts = await getAccounts(profile.id);
  const live = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);
  const total = live.reduce((s, a) => s + toNumber(a.balance), 0);

  if (accounts.length === 0) {
    return (
      <Empty title="No accounts yet." body="Add the places your money sits: a bank account, a card, the cash in your wallet. Then add transactions to them.">
        <NewAccountButton className={btn} label="Add your first account" />
      </Empty>
    );
  }

  const today = todayIso();
  const history = await getBalanceHistory(profile.id, live.map((a) => a.id), today, 60);

  return (
    <div className="flex flex-col gap-8">
      <p className="label">
        {live.length} active · net <Money value={total} currency={profile.currency} className="text-ink" />
      </p>
      <ul className="rise grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((a, i) => (
          <li key={a.id} className="relative" style={{ "--i": i } as React.CSSProperties}>
            <Link
              href={`/accounts/${a.id}`}
              className={`box group flex h-full min-h-52 w-full flex-col justify-between gap-5 overflow-hidden border border-line bg-night-2 p-6 transition-[translate,border-color] duration-300 ease-soft hover:-translate-y-1 hover:border-steel ${shapes[i % shapes.length]}`}
            >
              <span aria-hidden className="blob blob-a -right-28 -bottom-36 w-72 opacity-15 blur-xl" />
              <span className="flex items-center gap-3 pr-10">
                <AccountIcon kind={a.kind} />
                <span className="min-w-0">
                  <span className="block truncate text-[1.2rem] leading-tight font-bold tracking-[-0.02em]">{a.name}</span>
                  <span className={`${badge} mt-1`}>{kindLabels[a.kind]}</span>
                </span>
              </span>
              <MiniTrend
                name={a.name}
                currency={profile.currency}
                height={56}
                data={(history.get(a.id) ?? []).map((p) => ({ key: p.date, label: p.date === today ? "today" : shortDate(p.date), value: p.balance }))}
              />
              <span>
                <CountUp value={toNumber(a.balance)} currency={profile.currency} className="block text-[2rem] leading-none font-extrabold tracking-[-0.05em]" />
                <span className="label mt-2 flex items-center justify-between">
                  <span>
                    {a.count} transaction{a.count === 1 ? "" : "s"}
                  </span>
                  <span className="transition-transform duration-300 ease-soft group-hover:translate-x-1">open →</span>
                </span>
              </span>
            </Link>
            <EditAccountButton
              account={{ id: a.id, name: a.name, kind: a.kind, openingBalance: a.openingBalance, archived: false }}
              className={editBtn}
            >
              <Pencil className="size-4" aria-hidden />
              <span className="sr-only">Edit {a.name}</span>
            </EditAccountButton>
          </li>
        ))}
      </ul>
      {archived.length > 0 && (
        <section aria-labelledby="archived">
          <h2 id="archived" className="label mb-3">
            archived
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  className="flex w-full items-center justify-between gap-4 rounded-[1.1rem] border border-dashed border-ash px-5 py-3 text-ink-soft hover:text-ink"
                >
                  <span>{a.name}</span>
                  <Money value={a.balance} currency={profile.currency} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="label">
        Want the story behind a balance?{" "}
        <Link href="/assistant?q=Which%20account%20did%20I%20spend%20the%20most%20from%20this%20month%3F" className="text-ink underline">
          ask the assistant
        </Link>
      </p>
    </div>
  );
}
