"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ThemeToggle } from "@moneo/ui/theme-toggle";

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

// Rendered without a path in the static shell, before the URL is known.
export function NavShell({ path }: { path: string | null }) {
  return (
    <>
      <nav aria-label="Main" className={pill}>
        <Mark />
        <ul className="flex items-center gap-0.5">
          {[...links, settings].map((l) => {
            const on = active(path, l.href);
            return (
              <li key={l.href}>
                <Link href={l.href} aria-current={on ? "page" : undefined} className={`${pillLink} ${on ? "bg-scene text-night" : "text-ink-soft hover:text-ink"}`}>
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle />
        <div className="grid size-10 shrink-0 place-items-center">
          <UserButton />
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
            <UserButton />
          </div>
        </div>
      </header>

      <nav aria-label="Main" className={tabs}>
        {links.map((l) => {
          const on = active(path, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined} className={`${tab} ${on ? "bg-scene text-night" : "text-ink-soft"}`}>
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
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
