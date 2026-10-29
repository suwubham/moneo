import type { CSSProperties } from "react";
import { site } from "../../_lib/site";
import { AskCard } from "../ask-card";
import { Demo } from "../demo";
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
      className="wrap relative grid gap-12 pt-[max(6rem,calc(env(safe-area-inset-top)+5rem))] pb-12 [perspective:1600px] short:pt-24 md:pb-16 lg:grid-cols-[1fr_minmax(0,24rem)] lg:items-center"
    >
      <div>
        <p className="mb-6 flex items-center gap-3 font-mono text-[.8rem] text-scene">
          <span className="h-px w-10 bg-scene" aria-hidden />
          personal finance, with someone to ask
        </p>
        <h1
          id="hero-title"
          aria-label="Your money, explained."
          className="text-[clamp(4rem,14vw,10rem)] leading-[0.84] font-extrabold tracking-[-0.065em] short:text-[clamp(3rem,9vw,6rem)] lg:text-[clamp(4rem,8vw,8.5rem)]"
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

      <AskCard />

      <figure
        aria-label="A working demo of the Moneo overview, with sample numbers"
        className="peek rv rounded-[2.4rem_1.2rem_2.4rem_1.2rem] lg:col-span-2 border border-line bg-night p-3 shadow-[0_40px_80px_-40px_rgba(0,0,0,.7)] sm:p-5"
        style={{ "--d": 4 } as CSSProperties}
      >
        <Demo />
      </figure>
    </section>
  );
}
