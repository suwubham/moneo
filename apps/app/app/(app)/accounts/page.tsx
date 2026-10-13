import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { toNumber } from "@/lib/core/money";
import { kindLabels } from "@/lib/modules/accounts/constants";
import { getAccounts } from "@/lib/modules/accounts/service";
import { Empty } from "../../_components/empty";
import { Money } from "../../_components/money";
import { PageTitle } from "../../_components/page-title";
import { Skeleton } from "../../_components/skeleton";
import { badge, btn, btnPrimary } from "../../_components/styles";
import { EditAccountButton, NewAccountButton } from "./account-drawers";

export const metadata: Metadata = { title: "Accounts" };

const shapes = ["rounded-[2.4rem_1.2rem_2.4rem_1.2rem]", "rounded-[1.2rem_2.4rem_1.2rem_2.4rem]", "rounded-[1.1rem]"];

export default function AccountsPage() {
  return (
    <>
      <PageTitle eyebrow="where it lives" title="Your" fancy="accounts.">
        <NewAccountButton className={btnPrimary} />
      </PageTitle>
      <Suspense fallback={<AccountsSkeleton />}>
        <Accounts />
      </Suspense>
    </>
  );
}

function AccountsSkeleton() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-44" />
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

  return (
    <div className="flex flex-col gap-10">
      <p className="label">
        {live.length} active · net <Money value={total} currency={profile.currency} className="text-ink" />
      </p>
      <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {live.map((a, i) => (
          <li key={a.id}>
            <EditAccountButton
              account={{ id: a.id, name: a.name, kind: a.kind, openingBalance: a.openingBalance, archived: false }}
              className={`box group flex h-full min-h-44 w-full flex-col justify-between overflow-hidden border border-line bg-night-2 p-6 text-left transition-[translate,border-color] duration-300 ease-soft hover:-translate-y-1 hover:border-steel ${shapes[i % shapes.length]}`}
            >
              <span aria-hidden className="blob blob-a -right-28 -bottom-36 w-72 opacity-15 blur-xl" />
              <span className="flex items-start justify-between gap-3">
                <span className="text-[1.25rem] leading-tight font-bold tracking-[-0.02em]">{a.name}</span>
                <span className={badge}>{kindLabels[a.kind]}</span>
              </span>
              <span>
                <Money value={a.balance} currency={profile.currency} className="block text-[2.2rem] leading-none font-extrabold tracking-[-0.05em]" />
                <span className="label mt-2 block">
                  {a.count} transaction{a.count === 1 ? "" : "s"} · edit
                </span>
              </span>
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
                <EditAccountButton
                  account={{ id: a.id, name: a.name, kind: a.kind, openingBalance: a.openingBalance, archived: true }}
                  className="flex w-full items-center justify-between gap-4 rounded-[1.1rem] border border-dashed border-ash px-5 py-3 text-left text-ink-soft hover:text-ink"
                >
                  <span>{a.name}</span>
                  <Money value={a.balance} currency={profile.currency} />
                </EditAccountButton>
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
