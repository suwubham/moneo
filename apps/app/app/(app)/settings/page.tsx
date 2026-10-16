import type { Metadata } from "next";
import { requireProfile } from "@/lib/core/auth";
import { settings } from "@/lib/core/config";
import { getCategories } from "@/lib/modules/categories/service";
import { PageTitle } from "../../_components/page-title";
import { Reveal } from "../../_components/reveal";
import { ListSkeleton } from "../../_components/skeleton";
import { card } from "../../_components/styles";
import { AddCategory, CategoryChip, CurrencyForm, DeleteEverything, ImportCashew } from "./settings-ui";

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
          <h2 id="cats" className={heading}>
            Categories
          </h2>
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
