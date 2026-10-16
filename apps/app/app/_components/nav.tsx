"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useEffect } from "react";
import { ThemeToggle } from "@moneo/ui/theme-toggle";
import { ClientOnly } from "./client-only";

type Item = { href: string; label: string; short: string; scene: string; icon: React.ReactNode };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const links: Item[] = [
  {
    href: "/",
    label: "Overview",
    short: "Home",
    scene: "",
    icon: <path {...stroke} d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1Z" />,
  },
  {
    href: "/transactions",
    label: "Transactions",
    short: "Activity",
    scene: "frost",
    icon: <path {...stroke} d="M5 7h14M5 12h14M5 17h9" />,
  },
  {
    href: "/accounts",
    label: "Accounts",
    short: "Accounts",
    scene: "steel",
    icon: (
      <>
        <rect {...stroke} x="3.5" y="6" width="17" height="12" rx="2.5" />
        <path {...stroke} d="M3.5 10h17" />
      </>
    ),
  },
  {
    href: "/budgets",
    label: "Budgets",
    short: "Budgets",
    scene: "amber",
    icon: (
      <>
        <circle {...stroke} cx="12" cy="12" r="7.5" />
        <path {...stroke} d="M12 4.5V12l5.3 5.3" />
      </>
    ),
  },
  {
    href: "/assistant",
    label: "Assistant",
    short: "Ask",
    scene: "",
    icon: <path {...stroke} d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0a2 2 0 0 1-2-2Z" />,
  },
];

const settings = { href: "/settings", label: "Settings", scene: "steel" };

const pill =
  "fixed inset-x-0 top-4 z-40 mx-auto hidden w-fit items-center gap-1.5 rounded-full border border-line bg-night-2/90 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] pointer-fine:backdrop-blur-md md:flex";
const pillLink = "shrink-0 rounded-full px-3.5 py-2 font-mono text-[.78rem] whitespace-nowrap transition-colors duration-300 ease-soft";
const tabs =
  "fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-[1.4rem] border border-line bg-night-2/95 p-1 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] md:hidden";
const tab = "flex flex-col items-center gap-0.5 rounded-[1.1rem] py-1.5 font-mono text-[.64rem] transition-colors duration-300 ease-soft";
const iconBtn =
  "grid size-10 shrink-0 place-items-center rounded-full border border-line bg-night-3 text-ink-soft transition-colors duration-300 ease-soft hover:border-accent hover:text-ink";

function active(path: string | null, href: string) {
  if (path === null) return false;
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

function Avatar() {
  return (
    <ClientOnly fallback={<span aria-hidden className="size-7 rounded-full bg-night-3" />}>
      <UserButton />
    </ClientOnly>
  );
}

function Mark() {
  return (
    <Link
      href="/"
      aria-label="Moneo overview"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-night-3 text-[1.1rem] font-extrabold tracking-[-0.06em]"
    >
      <span>
        m<span className="text-accent">.</span>
      </span>
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const scene = [...links, settings].find((l) => active(path, l.href))?.scene;

  useEffect(() => {
    if (scene) document.body.dataset.scene = scene;
    else delete document.body.dataset.scene;
  }, [scene]);

  return <NavShell path={path} />;
}

// The tab you tapped lights up at once; the real path takes over when the page arrives.
function useTarget(path: string | null) {
  const [want, setWant] = useState<{ href: string; from: string | null } | null>(null);
  const target = want && want.from === path ? want.href : path;
  return [target, (href: string) => setWant({ href, from: path })] as const;
}

// One highlight that slides between links. Links differ in width, so it moves with translate and
// corrects its width with a short scaleX settle (transform only).
function PillIndicator({ list, href }: { list: React.RefObject<Map<string, HTMLAnchorElement>>; href: string | undefined }) {
  const el = useRef<HTMLSpanElement>(null);
  const last = useRef<{ x: number; w: number } | null>(null);

  // Measured after layout and written straight to the element: positions come from the DOM, not from React state.
  useLayoutEffect(() => {
    const span = el.current;
    const link = href ? list.current.get(href) : undefined;
    if (!span) return;
    if (!link) {
      span.style.opacity = "0";
      last.current = null;
      return;
    }
    const next = { x: link.offsetLeft, w: link.offsetWidth };
    span.style.opacity = "1";
    span.style.width = `${next.w}px`;
    span.style.transform = `translateX(${next.x}px)`;
    const prev = last.current;
    last.current = next;
    if (!prev || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    span.animate(
      [{ transform: `translateX(${prev.x}px) scaleX(${prev.w / next.w})` }, { transform: `translateX(${next.x}px) scaleX(1)` }],
      { duration: 320, easing: "cubic-bezier(0.7, 0, 0.2, 1)" },
    );
  }, [href, list]);

  return <span ref={el} aria-hidden className="absolute inset-y-0 left-0 origin-left rounded-full bg-scene opacity-0 transition-opacity duration-200" />;
}

// Rendered without a path in the static shell, before the URL is known.
export function NavShell({ path }: { path: string | null }) {
  const [target, go] = useTarget(path);
  const linkEls = useRef(new Map<string, HTMLAnchorElement>());
  const pillOn = [...links, settings].find((l) => active(target, l.href))?.href;
  const tabIndex = links.findIndex((l) => active(target, l.href));

  return (
    <>
      <nav aria-label="Main" className={pill} style={{ viewTransitionName: "nav-pill" }}>
        <Mark />
        <ul className="relative flex items-center gap-0.5">
          <PillIndicator list={linkEls} href={pillOn} />
          {[...links, settings].map((l) => {
            const on = l.href === pillOn;
            return (
              <li key={l.href} className="relative z-10">
                <Link
                  href={l.href}
                  ref={(e) => {
                    if (e) linkEls.current.set(l.href, e);
                    else linkEls.current.delete(l.href);
                  }}
                  onClick={() => go(l.href)}
                  aria-current={active(path, l.href) ? "page" : undefined}
                  className={`${pillLink} block ${on ? "text-night delay-150 duration-150" : "text-ink-soft duration-100 hover:text-ink"}`}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle />
        <div className="grid size-10 shrink-0 place-items-center">
          <Avatar />
        </div>
      </nav>

      <header className="wrap flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))] md:hidden">
        <Mark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href={settings.href} aria-label="Settings" aria-current={active(path, settings.href) ? "page" : undefined} className={`${iconBtn} aria-[current=page]:border-scene aria-[current=page]:text-ink`}>
            <svg viewBox="0 0 24 24" className="size-[1.15rem]" aria-hidden>
              <circle {...stroke} cx="12" cy="12" r="3" />
              <path
                {...stroke}
                d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z"
              />
            </svg>
          </Link>
          <div className="grid size-10 place-items-center">
            <Avatar />
          </div>
        </div>
      </header>

      <nav aria-label="Main" className={tabs} style={{ viewTransitionName: "nav-tabs" }}>
        {/* Tabs are equal width, so the highlight only needs to slide. */}
        <span
          aria-hidden
          className={`absolute top-1 bottom-1 left-1 rounded-[1.1rem] bg-scene transition-[translate,opacity] duration-300 ease-snap ${tabIndex < 0 ? "opacity-0" : ""}`}
          style={{ width: `calc((100% - 0.5rem) / ${links.length})`, translate: `${Math.max(0, tabIndex) * 100}% 0` }}
        />
        {links.map((l, i) => {
          const on = i === tabIndex;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => go(l.href)}
              aria-current={active(path, l.href) ? "page" : undefined}
              className={`${tab} relative z-10 ${on ? "text-night delay-150 duration-150" : "text-ink-soft duration-100"}`}
            >
              <svg viewBox="0 0 24 24" className={`size-5 transition-transform duration-300 ease-soft ${on ? "-translate-y-px scale-110" : ""}`} aria-hidden>
                {l.icon}
              </svg>
              {l.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
