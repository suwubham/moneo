"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  "fixed inset-x-0 top-4 z-40 mx-auto hidden w-fit items-center gap-1.5 rounded-full border border-line bg-night-2/90 p-1.5 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] pointer-fine:bg-night-2/70 pointer-fine:backdrop-blur-md md:flex";
const pillLink =
  "group relative isolate block shrink-0 rounded-full px-3.5 py-2 font-mono text-[.78rem] whitespace-nowrap text-ink-soft transition-colors duration-300 ease-soft hover:text-ink data-[active]:text-on-accent";
// Each link carries its own highlight, as on the site: it grows and fades in under the active one.
const glow =
  "absolute inset-0 -z-10 scale-75 bg-scene opacity-0 transition-[scale,opacity] duration-500 ease-snap group-data-[active]:scale-100 group-data-[active]:opacity-100";
const tabs =
  "fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-[1.4rem] border border-line bg-night-2/95 p-1 shadow-[0_18px_40px_-20px_rgba(0,0,0,.6)] md:hidden";
const tab =
  "group relative isolate flex flex-col items-center gap-0.5 rounded-[1.1rem] py-1.5 font-mono text-[.64rem] text-ink-soft transition-colors duration-300 ease-soft data-[active]:text-on-accent";
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

// The label rolls up to a copy of itself on hover.
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

// Rendered without a path in the static shell, before the URL is known.
export function NavShell({ path }: { path: string | null }) {
  const [target, go] = useTarget(path);

  return (
    <>
      <nav aria-label="Main" className={pill} style={{ viewTransitionName: "nav-pill" }}>
        <Mark />
        <ul className="flex items-center">
          {[...links, settings].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => go(l.href)}
                aria-current={active(path, l.href) ? "page" : undefined}
                data-active={active(target, l.href) || undefined}
                className={pillLink}
              >
                <span className={`${glow} rounded-full`} aria-hidden />
                <Roll>{l.label}</Roll>
              </Link>
            </li>
          ))}
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => go(l.href)}
            aria-current={active(path, l.href) ? "page" : undefined}
            data-active={active(target, l.href) || undefined}
            className={tab}
          >
            <span className={`${glow} rounded-[1.1rem]`} aria-hidden />
            <svg viewBox="0 0 24 24" className="size-5 transition-transform duration-300 ease-soft group-data-[active]:-translate-y-px group-data-[active]:scale-110" aria-hidden>
              {l.icon}
            </svg>
            {l.short}
          </Link>
        ))}
      </nav>
    </>
  );
}
