import type { CSSProperties, ElementType, ReactNode } from "react";

export function Split({ text, className = "", start = 0 }: { text: string; className?: string; start?: number }) {
  return (
    <span className={`split-row ${className}`} aria-hidden>
      {[...text].map((c, i) => (
        <span key={i} className="ch" style={{ "--i": start + i } as CSSProperties}>
          {c === " " ? " " : c}
        </span>
      ))}
    </span>
  );
}

export function Title({
  id,
  first,
  second,
  as: Tag = "h2",
  className = "",
}: {
  id?: string;
  first: string;
  second: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag
      id={id}
      aria-label={`${first} ${second}`}
      className={`text-[clamp(3.4rem,11vw,9.5rem)] leading-[0.86] font-extrabold tracking-[-0.06em] ${className}`}
    >
      <Split text={first} />
      <Split
        text={second}
        start={first.length}
        className="fancy ml-[clamp(.6rem,10vw,10rem)] tracking-[-0.04em] text-scene"
      />
    </Tag>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 flex items-center gap-3 font-mono text-[.8rem] text-scene">
      <span className="h-px w-10 bg-scene" aria-hidden />
      {children}
    </p>
  );
}
