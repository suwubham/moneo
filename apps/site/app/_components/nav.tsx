import Link from "next/link";
import { ThemeToggle } from "@moneo/ui/theme-toggle";
import { sections, site } from "../_lib/site";

const bar =
  "fixed inset-x-0 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-1.5 rounded-full border border-line bg-night-2/90 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] pointer-fine:bg-night-2/70 pointer-fine:backdrop-blur-md bottom-[max(1rem,env(safe-area-inset-bottom))] md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-auto";
const link =
  "group relative isolate block rounded-full px-3.5 py-2 font-mono text-[.78rem] whitespace-nowrap text-ink-soft transition-colors duration-300 ease-soft hover:text-ink data-[active]:text-on-accent";
const pill =
  "absolute inset-0 -z-10 scale-75 rounded-full bg-scene opacity-0 transition-[scale,opacity] duration-500 ease-snap group-data-[active]:scale-100 group-data-[active]:opacity-100";

function Roll({ children }: { children: string }) {
  return (
    <span className="relative block overflow-hidden">
      <span className="block transition-transform duration-500 ease-snap group-hover:-translate-y-full">{children}</span>
      <span aria-hidden className="absolute inset-0 translate-y-full transition-transform duration-500 ease-snap group-hover:translate-y-0">
        {children}
      </span>
    </span>
  );
}

export function Nav() {
  return (
    <>
      <div className="progress fixed inset-x-0 top-0 z-50 h-0.5 bg-scene" aria-hidden />
      <nav aria-label="Main" className={bar}>
        <Link
          href="/"
          aria-label="Moneo home"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-night-3 text-[1.05rem] font-extrabold tracking-[-0.06em]"
        >
          <span>
            M<span className="text-scene">.</span>
          </span>
        </Link>
        <ul className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} data-nav={s.id} className={link}>
                <span className={pill} aria-hidden />
                <Roll>{s.label}</Roll>
              </a>
            </li>
          ))}
        </ul>
        <ThemeToggle className="shrink-0" />
        <a
          href={site.app}
          className="live hidden items-center gap-2 rounded-full border border-line bg-night-3 px-4 py-2 font-mono text-[.78rem] text-ink transition-colors duration-300 ease-soft before:text-accent hover:border-accent lg:flex"
        >
          Open the app
        </a>
      </nav>
    </>
  );
}
