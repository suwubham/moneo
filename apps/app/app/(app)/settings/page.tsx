import type { Metadata } from "next";
import { requireProfile } from "@/lib/core/auth";
import { inboundEnabled, settings } from "@/lib/core/config";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getCategories } from "@/lib/modules/categories/service";
import { getInbox } from "@/lib/modules/inbound/service";
import { PageTitle } from "../../_components/page-title";
import { Reveal } from "../../_components/reveal";
import { ListSkeleton } from "../../_components/skeleton";
import { card } from "../../_components/styles";
import { AddCategory, CategoryChip, CurrencyForm, DeleteEverything, ImportCashew, ReorderCategories } from "./settings-ui";
import { Address, ForwardCode, Hints, Recent, ToCheck } from "./inbox-ui";

export const metadata: Metadata = { title: "Settings" };

const section = `${card} p-5 sm:p-7`;
const heading = "mb-1 text-[1.3rem] font-bold tracking-[-0.02em]";

export default function SettingsPage() {
  return (
    <>
      <PageTitle eyebrow="the small print" title="Your" fancy="settings." />
      <Reveal fallback={<ListSkeleton rows={3} />}>
        <Settings />
      </Reveal>
    </>
  );
}

async function Settings() {
  const profile = await requireProfile();
  const categories = await getCategories(profile.id);
  const groups = [
    { title: "spending", items: categories.filter((c) => c.kind === "expense") },
    { title: "income", items: categories.filter((c) => c.kind === "income") },
  ];

  return (
    <div className="rise grid items-start gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div style={{ "--i": 0 } as React.CSSProperties}>
        <section className={section} aria-labelledby="cats">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="cats" className={heading}>
              Categories
            </h2>
            <ReorderCategories categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color }))} />
          </div>
          <p className="mb-5 text-ink-soft">Tap one to change its name, icon or colour. Removing one leaves its transactions uncategorised and removes its budget.</p>
          {groups.map((g) => (
            <div key={g.title} className="mb-5">
              <h3 className="label mb-2">{g.title}</h3>
              <ul className="flex flex-wrap gap-2">
                {g.items.map((c) => (
                  <li key={c.id}>
                    <CategoryChip category={{ id: c.id, name: c.name, icon: c.icon, color: c.color }} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <AddCategory />
        </section>

        {inboundEnabled && <BankEmails userId={profile.id} categories={categories} />}
      </div>
      <div className="flex flex-col gap-4" style={{ "--i": 1 } as React.CSSProperties}>
        <section className={section} aria-labelledby="money">
          <h2 id="money" className={heading}>
            Currency
          </h2>
          <p className="mb-5 text-ink-soft">How amounts are shown. It does not convert anything.</p>
          <CurrencyForm currency={profile.currency} />
        </section>

        <section className={section} aria-labelledby="import">
          <h2 id="import" className={heading}>
            Import from Cashew
          </h2>
          <p className="mb-5 max-w-[56ch] text-ink-soft">
            Export a backup from Cashew (a .sql file) and pick it here. Wallets become accounts. Importing the same file
            again skips what is already here.
          </p>
          <ImportCashew currency={profile.currency} />
        </section>

        <section className={`${section} border-dashed border-accent/50`} aria-labelledby="danger">
          <h2 id="danger" className={heading}>
            Delete everything
          </h2>
          <p className="mb-5 max-w-[56ch] text-ink-soft">
            Removes your accounts, transactions, budgets and chats from Moneo, then your sign-in. This cannot be undone.
          </p>
          <DeleteEverything siteUrl={settings.siteUrl} />
        </section>
      </div>
    </div>
  );
}

async function BankEmails({ userId, categories }: { userId: string; categories: Awaited<ReturnType<typeof getCategories>> }) {
  const [inbox, accounts] = await Promise.all([getInbox(userId), getAccounts(userId)]);
  const open = accounts.filter((a) => !a.archivedAt).map((a) => ({ id: a.id, name: a.name }));
  const waiting = inbox.emails.filter((e) => e.status === "review");
  // Only the newest code matters; Gmail sends a fresh one each time the address is added again.
  const code = inbox.emails.find((e) => e.status === "code")?.code;
  const recent = inbox.emails.filter((e) => e.status !== "review").slice(0, 8);

  return (
    <section className={`${section} mt-4`} aria-labelledby="bank-emails">
      <h2 id="bank-emails" className={heading}>
        Bank emails
      </h2>
      <p className="mb-5 max-w-[60ch] text-ink-soft">
        Forward your bank&apos;s alerts to this address and the AI turns each one into a transaction. In Gmail, add it under Settings →
        Forwarding, then make a filter for your bank&apos;s alerts that forwards them here. We keep what was read from each email, not the email.
      </p>
      <Address address={inbox.address} />
      {code && (
        <div className="mt-4">
          <ForwardCode code={code} />
        </div>
      )}
      <ToCheck emails={waiting} accounts={open} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />

      <h3 className="label mt-6 mb-1">hints</h3>
      <p className="mb-3 text-[.9rem] text-ink-soft">
        Tell the AI what things in your emails mean: a store&apos;s real name and category, or which account a card belongs to.
      </p>
      <Hints hints={inbox.hints} />

      <h3 className="label mt-6 mb-2">recent</h3>
      <Recent emails={recent} />
    </section>
  );
}
