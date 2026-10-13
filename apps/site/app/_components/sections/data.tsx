import type { CSSProperties } from "react";
import Link from "next/link";
import { Eyebrow, Title } from "../split";

const points = [
  {
    k: "01",
    t: "Kept in one place",
    b: "Your accounts, transactions, budgets and chats live in our own database, tied to your login. We don't sell them.",
  },
  {
    k: "02",
    t: "Shared only to answer you",
    b: "When you use an AI feature, your question and the numbers it needs go to Gemini on Google Cloud's Vertex AI to write the answer.",
  },
  {
    k: "03",
    t: "Gone when you say so",
    b: "You can delete your data from Settings. We don't keep chat text in our logs.",
  },
];

export function Data() {
  return (
    <section id="data" data-sec data-scene="amber" aria-labelledby="data-title" className="wrap py-12 md:py-16">
      <Eyebrow>your data</Eyebrow>
      <Title id="data-title" first="Your data," second="your call." />

      <ol className="mt-12 grid gap-3.5 md:grid-cols-3">
        {points.map((p, i) => (
          <li
            key={p.k}
            className="rv rounded-[1.1rem] border border-line bg-night-2 p-[1.6rem]"
            style={{ "--d": i } as CSSProperties}
          >
            <p className="font-mono text-[.8rem] text-scene">{p.k}</p>
            <h3 className="mt-8 text-[1.5rem] leading-tight font-extrabold tracking-[-0.04em]">{p.t}</h3>
            <p className="mt-2 text-[.98rem] text-ink-soft">{p.b}</p>
          </li>
        ))}
      </ol>
      <p className="rv mt-8">
        <Link href="/privacy" className="font-mono text-[.85rem] underline">
          Read the privacy page →
        </Link>
      </p>
    </section>
  );
}
