import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/core/auth";
import { settings } from "@/lib/core/config";
import { getCategories } from "@/lib/modules/categories/service";
import { PageTitle } from "../../_components/page-title";
import { ListSkeleton } from "../../_components/skeleton";
import { card } from "../../_components/styles";
import { AddCategory, CurrencyForm, DeleteEverything, RemoveCategory } from "./settings-ui";

export const metadata: Metadata = { title: "Settings" };

const section = `${card} p-5 sm:p-7`;
const heading = "mb-1 text-[1.3rem] font-bold tracking-[-0.02em]";

export default function SettingsPage() {
  return (
    <>
      <PageTitle eyebrow="the small print" title="Your" fancy="settings." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Settings />
      </Suspense>
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
    <div className="flex max-w-3xl flex-col gap-4">
      <section className={section} aria-labelledby="money">
        <h2 id="money" className={heading}>
          Currency
        </h2>
        <p className="mb-5 text-ink-soft">How amounts are shown. It does not convert anything.</p>
        <CurrencyForm currency={profile.currency} />
      </section>

      <section className={section} aria-labelledby="cats">
        <h2 id="cats" className={heading}>
          Categories
        </h2>
        <p className="mb-5 text-ink-soft">Removing one leaves its transactions uncategorised and removes its budget.</p>
        {groups.map((g) => (
          <div key={g.title} className="mb-5">
            <h3 className="label mb-2">{g.title}</h3>
            <ul className="flex flex-wrap gap-2">
              {g.items.map((c) => (
                <li key={c.id} className="flex items-center gap-1 rounded-full border border-line bg-night py-1 pr-1.5 pl-3.5 text-[.9rem]">
                  {c.name}
                  <RemoveCategory id={c.id} name={c.name} />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <AddCategory />
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
  );
}
