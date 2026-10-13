const pad = (n: number) => String(n).padStart(2, "0");

export function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function todayIso(now = new Date()): string {
  return isoDate(now);
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export type Month = { key: string; start: string; end: string };

// Half-open range [start, end) so the last day of the month is never lost to time zones.
export function monthOf(key: string): Month {
  const [y, m] = key.split("-").map(Number);
  const start = `${y}-${pad(m)}-01`;
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { key: `${y}-${pad(m)}`, start, end };
}

export function currentMonth(now = new Date()): Month {
  return monthOf(`${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`);
}

export function shiftMonth(key: string, by: number): Month {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return monthOf(`${Math.floor(total / 12)}-${pad((total % 12) + 1)}`);
}

export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function monthLabel(key: string): string {
  const { start } = monthOf(key);
  return new Date(`${start}T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === shiftDays(today, -1)) return "Yesterday";
  const d = new Date(`${iso}T00:00:00Z`);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  });
}

export function daysInMonth(key: string): number {
  const { start, end } = monthOf(key);
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
}
