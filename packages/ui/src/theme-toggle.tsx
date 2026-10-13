"use client";

const btn =
  "grid size-10 place-items-center rounded-full border border-line bg-night-3 text-ink transition-colors duration-300 ease-soft hover:border-accent";

function current(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  function flip() {
    const next = current() === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const apply = () => {
      root.classList.add("theme-swap");
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {}
      requestAnimationFrame(() => root.classList.remove("theme-swap"));
    };
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  }

  return (
    <button type="button" onClick={flip} className={`${btn} ${className}`} aria-label="Switch light and dark theme">
      <svg viewBox="0 0 24 24" className="size-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
