import type { CSSProperties } from "react";
import { Eyebrow, Title } from "../split";

const bubble = "rv max-w-[34rem] rounded-[1.4rem] border border-line p-5";
const chip = "rounded-full border border-line bg-night/70 px-3 py-1 font-mono text-[.72rem] text-ink-soft";

const prompts = [
  "what did I spend on groceries this year?",
  "which subscriptions went up?",
  "am I on track with my budgets?",
  "where did my money go last weekend?",
];

export function Ask() {
  return (
    <section id="ask" data-sec data-scene="frost" aria-labelledby="ask-title" className="wrap py-12 md:py-16">
      <Eyebrow>the assistant</Eyebrow>
      <Title id="ask-title" first="Ask it" second="anything." />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_20rem] lg:items-start">
        <figure
          aria-label="Example conversation"
          className="box rounded-[2.4rem_1.2rem_2.4rem_1.2rem] border border-line bg-night-2 p-[clamp(1rem,3vw,2rem)]"
        >
          <div className="flex flex-col gap-4">
            <p className={`${bubble} self-end rounded-br-md bg-night-3`}>
              How much did we spend eating out last month?
            </p>
            <div className="rv flex flex-wrap gap-2" style={{ "--d": 1 } as CSSProperties}>
              <span className={chip}>looked at transactions · sep 1–30</span>
              <span className={chip}>compared with august</span>
            </div>
            <div className={`${bubble} rounded-bl-md bg-night`} style={{ "--d": 2 } as CSSProperties}>
              <p>
                You spent <strong className="tabular-nums">$412.80</strong> on dining in September, across 19
                transactions. That is <span className="fancy text-scene">18% more</span> than August.
              </p>
              <p className="mt-3 text-ink-soft">
                The biggest one was $64.20 on the 14th. Fridays made up almost half of it. Want me to suggest a dining
                budget for October?
              </p>
            </div>
          </div>
          <figcaption className="mt-8 border-t border-line pt-4 font-mono text-[.8rem] text-ink-soft">
            <span className="caret">ask moneo anything</span>
          </figcaption>
        </figure>

        <div className="rv" style={{ "--d": 2 } as CSSProperties}>
          <p className="label">things people ask</p>
          <ul className="mt-4 flex flex-col gap-2">
            {prompts.map((p) => (
              <li key={p} className="rounded-xl border border-line bg-night-2 px-4 py-3 text-[.95rem]">
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-[34ch] text-[.95rem] text-ink-soft">
            It only reads. It can&apos;t move money, and it shows you what it looked at.
          </p>
        </div>
      </div>
    </section>
  );
}
