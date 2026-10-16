import type { Metadata } from "next";
import { requireProfile } from "@/lib/core/auth";
import { PageTitle } from "../../_components/page-title";
import { Reveal } from "../../_components/reveal";
import { TransactionsLoading, TransactionsSection, readSearch } from "./section";

export const metadata: Metadata = { title: "Transactions" };

export default function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  return (
    <>
      <PageTitle eyebrow="money in, money out" title="Every" fancy="transaction." />
      <Reveal fallback={<TransactionsLoading />}>
        <Transactions searchParams={searchParams} />
      </Reveal>
    </>
  );
}

async function Transactions({ searchParams }: { searchParams: PageProps<"/transactions">["searchParams"] }) {
  // Read the session before the clock: Cache Components rejects new Date() ahead of request data.
  const profile = await requireProfile();
  return <TransactionsSection profile={profile} s={readSearch(await searchParams)} base="/transactions" />;
}
