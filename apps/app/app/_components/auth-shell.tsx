import { ClerkLoading } from "@clerk/nextjs";
import { Suspense } from "react";

// Letters rise one after another; the heading keeps a real aria-label for screen readers.
function Letters({ text, start = 0 }: { text: string; start?: number }) {
  return [...text].map((ch, i) => (
    <span key={i} className="letter inline-block" style={{ "--i": start + i } as React.CSSProperties}>
      {ch === " " ? " " : ch}
    </span>
  ));
}

// Same size as Clerk's card, so nothing moves when the real one arrives on top of it.
function CardPlaceholder() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 flex flex-col gap-5 rounded-[1.1rem] border border-line bg-night-2 p-8">
      <div className="mx-auto h-5 w-44 skeleton" />
      <div className="mx-auto -mt-2 h-3.5 w-56 skeleton" />
      <div className="mt-3 h-10 skeleton rounded-full" />
      <div className="mx-auto h-3 w-8 skeleton" />
      <div className="h-3.5 w-36 skeleton" />
      <div className="-mt-3 h-10 skeleton rounded-full" />
      <div className="h-10 rounded-full bg-accent/40" />
    </div>
  );
}

export function AuthShell({ title, fancy, children }: { title: string; fancy: string; children: React.ReactNode }) {
  return (
    <main className="wrap grid min-h-svh max-w-6xl items-center gap-10 py-12 lg:grid-cols-[1fr_auto] lg:gap-16">
      <div className="relative">
        <span aria-hidden className="blob blob-e -top-32 -left-40 w-[28rem] opacity-20 blur-2xl" />
        <p className="label rise-1 mb-4 flex items-center gap-3 text-scene before:h-px before:w-10 before:bg-scene">moneo</p>
        <h1 aria-label={`${title} ${fancy}`} className="text-[clamp(3rem,9vw,7rem)] leading-[0.86] font-extrabold tracking-[-0.06em]">
          <span aria-hidden className="block overflow-hidden pb-[0.06em]">
            <Letters text={title} />
          </span>
          <span aria-hidden className="fancy ml-[clamp(.6rem,6vw,5rem)] block overflow-hidden pb-[0.12em] tracking-[-0.03em] text-scene">
            <Letters text={fancy} start={title.length} />
          </span>
        </h1>
        <p className="rise-1 mt-6 max-w-[34ch] text-ink-soft [animation-delay:400ms]">Your accounts, budgets and spending in one calm place.</p>
      </div>
      <div className="relative min-h-[32rem] w-[min(25rem,calc(100vw-2rem))] justify-self-center lg:justify-self-end">
        <ClerkLoading>
          <CardPlaceholder />
        </ClerkLoading>
        <div className="relative">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </div>
    </main>
  );
}
