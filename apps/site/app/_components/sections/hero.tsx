import type { CSSProperties } from "react";
import { site } from "../../_lib/site";
import { Split } from "../split";

const cta =
  "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-4 font-bold text-on-accent transition-transform duration-400 ease-soft hover:-translate-y-[3px]";
const ghost =
  "inline-flex items-center gap-2 rounded-full border border-line px-6 py-4 font-bold text-ink transition-[translate,border-color] duration-400 ease-soft hover:-translate-y-[3px] hover:border-steel";

export function Hero() {
  return (
    <section
      id="top"
      data-sec
      aria-labelledby="hero-title"
      className="wrap relative grid min-h-[100svh] content-center gap-12 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] pb-28 md:pb-16 short:min-h-0 short:pt-24 lg:grid-cols-[1fr_auto] lg:items-end"
    >
      <div>
        <p className="mb-6 flex items-center gap-3 font-mono text-[.8rem] text-scene">
          <span className="h-px w-10 bg-scene" aria-hidden />
          personal finance, with someone to ask
        </p>
        <h1
          id="hero-title"
          aria-label="Your money, explained."
          className="text-[clamp(4rem,14vw,10rem)] leading-[0.84] font-extrabold tracking-[-0.065em] short:text-[clamp(3rem,9vw,6rem)]"
        >
          <Split text="Your money," />
          <Split text="explained." start={11} className="fancy ml-[clamp(.6rem,10vw,10rem)] tracking-[-0.04em] text-scene" />
        </h1>
        <p className="rv mt-10 max-w-[40ch] text-ink-soft" style={{ "--d": 2 } as CSSProperties}>
          Moneo keeps your accounts, spending and budgets in one calm place. Then it answers questions about them in
          plain words, like a friend who is good with numbers and never judges the takeaway.
        </p>
        <div className="rv mt-8 flex flex-wrap gap-3" style={{ "--d": 3 } as CSSProperties}>
          <a href={site.signUp} className={cta}>
            Start free <span aria-hidden>↗</span>
          </a>
          <a href={site.signIn} className={ghost}>
            Sign in
          </a>
        </div>
      </div>

      <aside
        aria-label="Example insight"
        className="sticker rv w-full max-w-[19rem] justify-self-start rounded-[1.6rem_.8rem_1.6rem_.8rem] border border-line bg-night-2 p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] lg:justify-self-end"
        style={{ "--rz": "3deg", "--d": 4 } as CSSProperties}
      >
        <p className="label">this month, so far</p>
        <p className="mt-3 text-[2.6rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
          $1,284<span className="text-ink-soft">.60</span>
        </p>
        <p className="mt-1 label">spent across 46 transactions</p>
        <div className="mt-5 space-y-2.5">
          {[
            { k: "groceries", v: 0.62 },
            { k: "dining", v: 0.88 },
            { k: "transport", v: 0.34 },
          ].map((b) => (
            <div key={b.k}>
              <div className="flex justify-between font-mono text-[.72rem] text-ink-soft">
                <span>{b.k}</span>
                <span className="tabular-nums">{Math.round(b.v * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-night-3">
                <div
                  className={`h-full origin-left rounded-full ${b.v > 0.8 ? "bg-amber" : "bg-steel"}`}
                  style={{ transform: `scaleX(${b.v})` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 border-t border-line pt-4 text-[.92rem] leading-snug">
          Dining is <span className="fancy text-scene">18% up</span> on last month. Mostly Fridays.
        </p>
      </aside>
    </section>
  );
}
