"use client";

import { useEffect, useRef } from "react";
import { formatMoney } from "@/lib/core/money";

// The server renders the final amount; the browser counts up to it once, so no-JS and reduced motion see the number.
export function CountUp({
  value,
  currency,
  sign = false,
  compact = false,
  className = "",
}: {
  value: number;
  currency: string;
  sign?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(value) < 1) return;
    let raf = 0;
    const whole = Math.round(value * 100) % 100 === 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100);
      const eased = 1 - (1 - p) ** 3;
      // A whole amount counts in whole steps, so cents never flash in and out on the way.
      const shown = whole ? Math.round(value * eased) : value * eased;
      el.textContent = formatMoney(shown, currency, { sign, compact });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, currency, sign, compact]);
  return (
    <span ref={ref} className={className}>
      {formatMoney(value, currency, { sign, compact })}
    </span>
  );
}
