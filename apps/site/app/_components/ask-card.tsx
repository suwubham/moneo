"use client";

import { type CSSProperties, useEffect, useState, useSyncExternalStore } from "react";

// The hero's "someone to ask": a question types itself, the assistant says what it looked at, then answers.
// Made-up numbers that agree with the demo below. Nothing is sent anywhere.
const QUESTIONS = [
  {
    chip: "eating out",
    q: "How much did I spend eating out last month?",
    looked: ["transactions · sep 1–30", "compared with august"],
    answer: ["$350 on dining in September, ", "30% less", " than August. Fridays were a third of it."],
    bars: [
      { k: "may", v: 380 },
      { k: "jun", v: 455 },
      { k: "jul", v: 341 },
      { k: "aug", v: 498 },
      { k: "sep", v: 350, hot: true },
    ],
  },
  {
    chip: "subscriptions",
    q: "Which subscriptions went up?",
    looked: ["subscriptions · 6 months"],
    answer: ["Two did. Streamly and your gym went up in August, ", "$144 more", " a year between them."],
    bars: [
      { k: "may", v: 96 },
      { k: "jun", v: 96 },
      { k: "jul", v: 96 },
      { k: "aug", v: 108, hot: true },
      { k: "sep", v: 108 },
      { k: "oct", v: 108 },
    ],
  },
  {
    chip: "budgets",
    q: "Am I on track with my budgets?",
    looked: ["budgets · october", "days left · 9"],
    answer: ["Mostly. Groceries is at 72% with nine days to go. Dining is at ", "94%", ", so that one is close."],
    bars: [
      { k: "groc", v: 72 },
      { k: "dining", v: 94, hot: true },
      { k: "travel", v: 54 },
    ],
  },
];

type Phase = "typing" | "looking" | "answer";
const TYPE_MS = 34;
const LOOK_MS = 900;
const HOLD_MS = 6500;

// JS-made motion checks reduced motion itself: the CSS kill switch can't reach it.
const REDUCE = "(prefers-reduced-motion: reduce)";
function onReduceChange(fn: () => void) {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
}

export function AskCard() {
  const reduced = useSyncExternalStore(onReduceChange, () => matchMedia(REDUCE).matches, () => false);
  const [n, setN] = useState(0);
  const [count, setTyped] = useState(0);
  const [step, setPhase] = useState<Phase>("typing");
  // Without motion the whole exchange shows at once, and nothing cycles.
  const typed = reduced ? Infinity : count;
  const phase = reduced ? "answer" : step;
  const [auto, setAuto] = useState(true);
  const [paused, setPaused] = useState(false);
  const item = QUESTIONS[n];

  function go(next: number) {
    setN(next);
    setTyped(0);
    setPhase("typing");
  }

  useEffect(() => {
    if (reduced) return;
    if (phase === "typing") {
      if (typed >= item.q.length) {
        const t = setTimeout(() => setPhase("looking"), 250);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setTyped((c) => c + 1), TYPE_MS);
      return () => clearTimeout(t);
    }
    if (phase === "looking") {
      const t = setTimeout(() => setPhase("answer"), LOOK_MS);
      return () => clearTimeout(t);
    }
    if (auto && !paused) {
      const t = setTimeout(() => go((n + 1) % QUESTIONS.length), HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [reduced, phase, typed, item.q.length, auto, paused, n]);

  const max = Math.max(...item.bars.map((b) => b.v));
  const shown = phase !== "typing";

  return (
    <aside
      aria-label="Example question to the assistant"
      className="sticker rv w-full max-w-[24rem] hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] justify-self-end rounded-[1.6rem_.8rem_1.6rem_.8rem] border border-line bg-night-2 p-5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] max-lg:hidden"
      style={{ "--rz": "2deg", "--d": 4 } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="label flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-scene" aria-hidden />
        ask moneo
      </p>

      <p className="mt-4 ml-auto w-fit max-w-[19rem] rounded-[1.1rem] rounded-br-md bg-night-3 px-4 py-2.5 text-[.95rem]">
        <span className="sr-only">{item.q}</span>
        <span aria-hidden>
          {item.q.slice(0, typed)}
          {phase === "typing" && <span className="ml-px inline-block h-[1em] w-0.5 translate-y-[.15em] animate-pulse bg-scene" />}
        </span>
      </p>

      <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
        {shown &&
          item.looked.map((l, k) => (
            <span key={l} className="tick rounded-full border border-line bg-night/70 px-2.5 py-0.5 font-mono text-[.68rem] text-ink-soft" style={{ animationDelay: `${k * 120}ms` }}>
              {l}
            </span>
          ))}
        {phase === "looking" && (
          <span className="flex items-center gap-1 px-1" aria-hidden>
            {[0, 1, 2].map((k) => (
              <span key={k} className="size-1.5 animate-pulse rounded-full bg-ink-soft" style={{ animationDelay: `${k * 150}ms` }} />
            ))}
          </span>
        )}
      </div>

      <div className={`mt-3 min-h-[11rem] rounded-[1.1rem] rounded-bl-md bg-night p-4 transition-opacity duration-[450ms] ease-soft ${phase === "answer" ? "opacity-100" : "opacity-0"}`}>
        <p className="text-[.95rem] leading-snug">
          {item.answer[0]}
          <span className="fancy text-scene">{item.answer[1]}</span>
          {item.answer[2]}
        </p>
        <div className="mt-4 flex h-20 items-end gap-2" aria-hidden>
          {item.bars.map((b, k) => (
            <span key={item.chip + b.k} className="flex h-full flex-1 flex-col items-center gap-1">
              <span className="flex w-full max-w-5 flex-1 items-end">
                <span
                  className={`block size-full origin-bottom rounded-t-[3px] transition-transform duration-[450ms] ease-snap ${b.hot ? "bg-amber" : "bg-steel/60"}`}
                  style={{ transform: `scaleY(${phase === "answer" ? b.v / max : 0})`, transitionDelay: `${k * 60}ms` }}
                />
              </span>
              <span className="font-mono text-[.6rem] text-ink-soft">{b.k}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
        {QUESTIONS.map((x, k) => (
          <button
            key={x.chip}
            type="button"
            aria-pressed={k === n}
            onClick={() => {
              setAuto(false);
              go(k);
            }}
            className={`rounded-full border px-3 py-1 font-mono text-[.72rem] transition-[scale,border-color,color] duration-[120ms] active:scale-95 ${k === n ? "border-steel text-ink" : "border-line text-ink-soft hover:border-steel"}`}
          >
            {x.chip}
          </button>
        ))}
      </div>
    </aside>
  );
}
