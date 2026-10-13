import type { CSSProperties } from "react";
import { Eyebrow, Title } from "../split";

const tile = "box rv flex flex-col justify-between gap-10 overflow-hidden border border-line p-[1.6rem]";
const tileTitle = "max-w-[16ch] text-[clamp(1.7rem,3.2vw,2.4rem)] leading-[0.95] font-extrabold tracking-[-0.045em]";
const body = "mt-3 max-w-[40ch] text-[.98rem] text-ink-soft";
const chip = "rounded-full border border-line bg-night/70 px-3 py-1 font-mono text-[.72rem]";

function d(n: number) {
  return { "--d": n } as CSSProperties;
}

function Pages() {
  return (
    <div className="pages relative h-20 w-28" aria-hidden>
      <span className="absolute inset-0 rotate-[-8deg] rounded-xl border border-line bg-night-3" />
      <span className="absolute inset-0 rotate-[2deg] rounded-xl border border-line bg-night-2" />
      <span className="absolute inset-0 rotate-[9deg] rounded-xl border border-steel bg-night-3 p-3">
        <span className="block h-1.5 w-10 rounded-full bg-steel" />
        <span className="mt-2 block h-1.5 w-14 rounded-full bg-ash" />
      </span>
    </div>
  );
}

function Eq() {
  const bars = [0.5, 0.9, 0.65, 1, 0.4, 0.75, 0.55];
  return (
    <svg viewBox="0 0 70 40" className="eq h-12 w-24 text-amber" aria-hidden>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={40 - h * 40}
          width="6"
          height={h * 40}
          rx="2"
          fill="currentColor"
          style={{ "--i": i } as CSSProperties}
        />
      ))}
    </svg>
  );
}

function Ring() {
  return (
    <svg viewBox="0 0 40 40" className="size-24 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-night-3" />
      <circle
        cx="20"
        cy="20"
        r="15.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        pathLength={100}
        className="ring-draw text-frost"
        style={{ "--to": 28 } as CSSProperties}
      />
    </svg>
  );
}

function Fan() {
  const r = [-24, -12, 0, 12, 24];
  return (
    <svg viewBox="0 0 120 60" className="fan h-16 w-32 text-ink" aria-hidden>
      {r.map((deg, i) => (
        <circle
          key={deg}
          cx="60"
          cy="34"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35 + i * 0.15}
          strokeWidth="1.5"
          style={{ "--r": `${deg}deg` } as CSSProperties}
        />
      ))}
    </svg>
  );
}

export function Features() {
  return (
    <section id="features" data-sec data-scene="steel" aria-labelledby="features-title" className="wrap py-12 md:py-16">
      <Eyebrow>what it does</Eyebrow>
      <Title id="features-title" first="Small app," second="big help." />

      <div className="mt-12 grid grid-flow-row-dense auto-rows-[minmax(10rem,auto)] grid-cols-6 gap-3.5 lg:grid-flow-row lg:grid-cols-12">
        <article className={`${tile} col-span-6 rounded-[2.4rem_1.2rem_2.4rem_1.2rem] bg-night-2 lg:col-span-5`} style={d(0)}>
          <span className="blob blob-a -top-24 -right-20 w-72 opacity-40" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <p className="label">accounts</p>
            <Pages />
          </div>
          <div>
            <h3 className={tileTitle}>Every account, one total.</h3>
            <p className={body}>
              Checking, savings, the credit card you try not to look at. Add them once and see what you are worth today.
            </p>
          </div>
        </article>

        <article className={`${tile} col-span-6 rounded-[1.1rem] bg-night-3 lg:col-span-7`} style={d(1)}>
          <div className="flex items-start justify-between gap-4">
            <p className="label">transactions</p>
            <Eq />
          </div>
          <div>
            <h3 className={tileTitle}>Type it like a text.</h3>
            <p className={body}>Write what happened. Moneo turns it into a tidy entry for you to check and save.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-night px-3 py-2 font-mono text-[.8rem]">
                coffee 4.50 yesterday on visa
              </span>
              <span className="text-ink-soft" aria-hidden>
                →
              </span>
              <span className={chip}>dining</span>
              <span className={chip}>−4.50</span>
              <span className={chip}>visa</span>
            </div>
          </div>
        </article>

        <article
          className={`${tile} col-span-3 rounded-[1.2rem_2.4rem_1.2rem_2.4rem] bg-night-2 max-sm:col-span-6 lg:col-span-4`}
          style={d(2)}
        >
          <span className="blob blob-a -bottom-40 -left-32 w-80 opacity-20" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <p className="label">budgets</p>
            <Ring />
          </div>
          <div>
            <h3 className={tileTitle}>Limits that nudge, not nag.</h3>
            <p className={body}>One number per category, every month. You see how much is left at a glance.</p>
          </div>
        </article>

        <article
          className={`${tile} col-span-3 rounded-[50%_50%_1.6rem_1.6rem/38%_38%_1.6rem_1.6rem] bg-linear-to-b from-crimson/30 to-night-2 max-sm:col-span-6 lg:col-span-8 lg:rounded-[2.4rem_1.2rem_2.4rem_1.2rem]`}
          style={d(3)}
        >
          <span className="blob blob-e -top-24 right-0 w-80 opacity-40" aria-hidden />
          <div className="flex items-start justify-between gap-4">
            <p className="label">assistant</p>
            <Fan />
          </div>
          <div>
            <h3 className={tileTitle}>
              Ask it anything about <span className="fancy font-light">your</span> money.
            </h3>
            <p className={body}>
              It reads your own accounts and transactions to answer, and tells you where the numbers came from.
            </p>
          </div>
        </article>

        <article
          className="rv col-span-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 rounded-[1.1rem] border border-dashed border-ash p-[1.6rem] lg:col-span-12"
          style={d(4)}
        >
          <p className="label">in progress</p>
          <p className="max-w-[48ch] text-ink-soft">
            Next up: a safe sandbox where the assistant can do real sums and draw charts for you.
          </p>
        </article>
      </div>
    </section>
  );
}
