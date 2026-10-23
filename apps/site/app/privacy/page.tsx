import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@moneo/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Moneo stores, who it shares it with, and how to delete it.",
};

const h2 = "mt-14 text-[clamp(1.6rem,4vw,2.2rem)] leading-tight font-extrabold tracking-[-0.04em]";
const p = "mt-4 max-w-[60ch] text-ink-soft";
const li = "max-w-[60ch] text-ink-soft";

export default function Privacy() {
  return (
    <>
      <header className="wrap flex items-center justify-between pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="Moneo home"
          className="grid size-10 place-items-center rounded-full border border-line bg-night-3 text-[1.05rem] font-extrabold tracking-[-0.06em]"
        >
          M<span className="text-accent">.</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="wrap pt-16 pb-[max(4rem,env(safe-area-inset-bottom))]">
        <p className="inline-block rounded-full border border-dashed border-ash px-3 py-1 font-mono text-[.72rem] text-ink-soft">
          draft — needs legal and compliance review before launch
        </p>
        <h1
          aria-label="Privacy, in plain words."
          className="mt-8 text-[clamp(3.4rem,11vw,8rem)] leading-[0.86] font-extrabold tracking-[-0.06em]"
        >
          <span className="block">Privacy,</span>
          <span className="fancy ml-[clamp(.6rem,10vw,10rem)] block tracking-[-0.04em] text-accent">in plain words.</span>
        </h1>

        <article className="mt-12">
          <h2 className={h2}>What we store</h2>
          <p className={p}>To run Moneo we keep the things you add, in our Postgres database, tied to your login:</p>
          <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 marker:text-ash">
            <li className={li}>account names, types and opening balances</li>
            <li className={li}>transactions: amount, date, description, category and any note</li>
            <li className={li}>budgets (with the limits they had in past months) and categories</li>
            <li className={li}>your chats with the assistant</li>
            <li className={li}>a few settings, like your currency</li>
          </ul>

          <p className={p}>
            If you import a Cashew backup, our server reads the file once, keeps its wallets, categories and
            transactions as listed above, and deletes the file straight away.
          </p>

          <h2 className={h2}>On your device</h2>
          <p className={p}>
            So Moneo still works without internet, your browser keeps a copy of your accounts, budgets and the last
            three months of transactions, plus anything you add while offline until it reaches our server. It stays in
            this browser only and is removed when you sign out. If you share a device, sign out when you are done.
          </p>

          <h2 className={h2}>Signing in</h2>
          <p className={p}>
            Sign-in is handled by Clerk. Clerk holds your email address and login details. Moneo keeps only the user id
            Clerk gives us, so we know which data is yours.
          </p>

          <h2 className={h2}>The AI features</h2>
          <p className={p}>
            When you use an AI feature (the assistant, quick add, the monthly read or budget suggestions), we send your
            message and the financial data needed to answer it to Google Cloud&apos;s Vertex AI, where a Gemini model writes the answer and
            we show it to you. We only send what that feature needs, not your whole history at once.
          </p>
          <p className={p}>
            When you ask the assistant for a chart, a downloadable file or an interactive widget, the data it needs is copied
            to a private, isolated computer at Vercel Sandbox (in Singapore) that has no internet access, and a short script
            made by the model turns it into the file. That copy holds dates, amounts and which account, category and budget each
            transaction belongs to, never your descriptions or notes. It is kept for up to 7 days so follow-up requests in the
            same chat can use it. The files made are stored in Cloudflare R2. Deleting the chat or your account deletes both.
          </p>

          <h2 className={h2}>What we don&apos;t do</h2>
          <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 marker:text-ash">
            <li className={li}>We don&apos;t sell your data.</li>
            <li className={li}>We don&apos;t write the text of your messages or transactions into our logs.</li>
            <li className={li}>The assistant can read your data, but it can&apos;t move money or change anything.</li>
          </ul>

          <h2 className={h2}>Deleting your data</h2>
          <p className={p}>
            You can delete your data from Settings in the app. That removes your accounts, transactions, budgets,
            categories and chats from our database.
          </p>

          <h2 className={h2}>Questions</h2>
          <p className={p}>If something here is unclear, ask us. We will update this page when what we collect changes.</p>
        </article>
      </main>
    </>
  );
}
