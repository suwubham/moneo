import { Suspense } from "react";
import { Skeleton } from "./skeleton";

export function AuthShell({ title, fancy, children }: { title: string; fancy: string; children: React.ReactNode }) {
  return (
    <main className="wrap grid min-h-svh max-w-6xl items-center gap-10 py-12 lg:grid-cols-[1fr_auto] lg:gap-16">
      <div className="relative">
        <span aria-hidden className="blob blob-e -top-32 -left-40 w-[28rem] opacity-20 blur-2xl" />
        <p className="label mb-4 flex items-center gap-3 text-scene before:h-px before:w-10 before:bg-scene">moneo</p>
        <h1 aria-label={`${title} ${fancy}`} className="text-[clamp(3rem,9vw,7rem)] leading-[0.86] font-extrabold tracking-[-0.06em]">
          <span aria-hidden className="block">
            {title}
          </span>
          <span aria-hidden className="fancy ml-[clamp(.6rem,6vw,5rem)] block tracking-[-0.03em] text-scene">
            {fancy}
          </span>
        </h1>
      </div>
      <div className="justify-self-center lg:justify-self-end">
        <Suspense fallback={<Skeleton className="h-[30rem] w-[min(25rem,90vw)] rounded-[1.1rem]" />}>{children}</Suspense>
      </div>
    </main>
  );
}
