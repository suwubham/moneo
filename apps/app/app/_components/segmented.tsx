// Equal-width options with one highlight that slides to the picked one (transform only).
export function Segmented({ count, index, className = "", children }: { count: number; index: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative grid rounded-full border border-line p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-scene transition-transform duration-300 ease-snap"
        style={{ width: `calc((100% - 0.5rem) / ${count})`, transform: `translateX(${index * 100}%)` }}
      />
      {children}
    </div>
  );
}

// The text of an option sits above the highlight and flips colour with it.
// The picked label darkens as the highlight lands under it, not before, so it never vanishes mid-slide.
export const segItem = (on: boolean) =>
  `relative z-10 rounded-full px-3 py-1.5 text-center font-mono text-[.78rem] whitespace-nowrap transition-colors ease-soft ${on ? "text-night delay-150 duration-150" : "text-ink-soft duration-100 hover:text-ink"}`;
