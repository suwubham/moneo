const questions = [
  "what did I spend on groceries this year?",
  "which subscriptions went up?",
  "am I on track with my budgets?",
  "where did my money go last weekend?",
  "how does this month compare to last?",
  "what were my five biggest expenses?",
  "how much went on dining in september?",
];

// Two copies side by side; the band slides one copy's width, so the loop never shows a seam.
export function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 gap-3 pr-3" aria-hidden={hidden || undefined}>
      {questions.map((q) => (
        <li key={q} className="rounded-full border border-line bg-night-2 px-5 py-3 whitespace-nowrap text-[clamp(.95rem,1.6vw,1.2rem)]">
          <span className="mr-2 font-mono text-[.8em] text-scene">ask</span>
          {q}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee relative overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <p className="sr-only">Things people ask the assistant</p>
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
