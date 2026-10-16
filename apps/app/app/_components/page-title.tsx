// Smaller than the landing site's titles: in the app the numbers are the headline, not the page name.
export function PageTitle({ eyebrow, title, fancy, children }: { eyebrow: string; title: string; fancy: string; children?: React.ReactNode }) {
  return (
    <header className="rise-1 mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div>
        <p className="label mb-2 flex items-center gap-3 text-scene before:h-px before:w-10 before:bg-scene">{eyebrow}</p>
        <h1 aria-label={`${title} ${fancy}`} className="text-[clamp(2.1rem,4.6vw,3.4rem)] leading-[0.95] font-extrabold tracking-[-0.05em]">
          <span aria-hidden>{title} </span>
          <span aria-hidden className="fancy tracking-[-0.03em] text-scene">
            {fancy}
          </span>
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}
