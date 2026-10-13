import Link from "next/link";
import { site } from "../../_lib/site";

const link = "font-mono text-[.8rem] text-ink-soft transition-colors duration-300 ease-soft hover:text-ink";

export function Footer() {
  return (
    <footer className="wrap overflow-hidden pt-16 pb-[max(7rem,calc(env(safe-area-inset-bottom)+6rem))] md:pb-12">
      <a href={site.signUp} aria-label="Start free with Moneo" className="group relative block select-none">
        <span
          aria-hidden
          className="outline-text block text-[clamp(5rem,26vw,22rem)] leading-[0.8] font-extrabold tracking-[-0.07em]"
        >
          moneo
        </span>
        <span
          aria-hidden
          className="absolute inset-0 text-[clamp(5rem,26vw,22rem)] leading-[0.8] font-extrabold tracking-[-0.07em] text-scene opacity-0 transition-opacity duration-700 ease-soft group-hover:opacity-100"
        >
          moneo
        </span>
      </a>
      <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
        <p className="fancy max-w-[30ch] text-[1.15rem] text-ink-soft">Made for the question: where did it all go?</p>
        <ul className="flex flex-wrap gap-5">
          <li>
            <Link href="/privacy" className={link}>
              privacy
            </Link>
          </li>
          <li>
            <a href={site.signIn} className={link}>
              sign in
            </a>
          </li>
          <li>
            <span className="label">© 2026 Moneo</span>
          </li>
        </ul>
      </div>
    </footer>
  );
}
