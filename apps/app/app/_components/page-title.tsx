export function PageTitle({ eyebrow, title, fancy, children }: { eyebrow: string; title: string; fancy: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <div>
        <p className="label mb-3 flex items-center gap-3 text-scene before:h-px before:w-10 before:bg-scene">{eyebrow}</p>
        <h1
          aria-label={`${title} ${fancy}`}
          className="text-[clamp(2.6rem,7vw,5.2rem)] leading-[0.88] font-extrabold tracking-[-0.055em]"
        >
          <span aria-hidden className="block">
            {title}
          </span>
          <span aria-hidden className="fancy ml-[clamp(.6rem,5vw,4rem)] block tracking-[-0.03em] text-scene">
            {fancy}
          </span>
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}
