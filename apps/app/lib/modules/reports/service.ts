import "server-only";
import { type Month, daysInMonth, shiftDays, shiftMonth } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { getDb } from "@/lib/db";
import { getAccounts } from "@/lib/modules/accounts/service";
import { balancesBefore, dailyNet, dailySpend, monthlyFlow, spendingByCategory } from "./repository";

export function getSpendingByCategory(userId: string, range: { start: string; end: string }, limit?: number) {
  return spendingByCategory(getDb(), userId, range, limit);
}

export async function getMonthlyFlow(userId: string, month: Month, months = 6) {
  const first = shiftMonth(month.key, -(months - 1));
  const rows = await monthlyFlow(getDb(), userId, { start: first.start, end: month.end });
  const byKey = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: months }, (_, i) => {
    const key = shiftMonth(first.key, i).key;
    const r = byKey.get(key);
    return { month: key, moneyIn: toNumber(r?.moneyIn), moneyOut: toNumber(r?.moneyOut) };
  });
}

export async function getNetWorth(userId: string) {
  const accounts = await getAccounts(userId);
  const live = accounts.filter((a) => !a.archivedAt);
  return {
    total: live.reduce((s, a) => s + toNumber(a.balance), 0),
    accounts: live.length,
  };
}

// Average monthly spend per category over the last full months, for budget suggestions.
export async function getAverageSpend(userId: string, month: Month, months = 3) {
  const start = shiftMonth(month.key, -months).start;
  const rows = await spendingByCategory(getDb(), userId, { start, end: month.start }, 50);
  return rows
    .filter((r) => r.categoryId)
    .map((r) => ({ categoryId: r.categoryId!, name: r.name, average: Math.round((toNumber(r.spent) / months) * 100) / 100 }));
}

// Running spend by day of month, this month against the one before. Future days stay empty.
export async function getSpendingPace(userId: string, month: Month, today: string) {
  const prev = shiftMonth(month.key, -1);
  const rows = await dailySpend(getDb(), userId, { start: prev.start, end: month.end });
  const byDay = new Map(rows.map((r) => [r.day, toNumber(r.spent)]));
  const days = Math.max(daysInMonth(month.key), daysInMonth(prev.key));
  const run = { now: 0, before: 0 };
  return Array.from({ length: days }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const nowDay = `${month.key}-${d}`;
    const beforeDay = `${prev.key}-${d}`;
    const inNow = i < daysInMonth(month.key) && nowDay <= today;
    const inBefore = i < daysInMonth(prev.key);
    if (inNow) run.now += byDay.get(nowDay) ?? 0;
    if (inBefore) run.before += byDay.get(beforeDay) ?? 0;
    return { day: i + 1, now: inNow ? Math.round(run.now * 100) / 100 : null, before: inBefore ? Math.round(run.before * 100) / 100 : null };
  });
}

// Daily closing balance per account over the last `days` days.
export async function getBalanceHistory(userId: string, accountIds: string[], today: string, days = 90) {
  const from = shiftDays(today, -(days - 1));
  if (accountIds.length === 0) return new Map<string, { date: string; balance: number }[]>();
  const [start, nets] = await Promise.all([balancesBefore(getDb(), userId, from), dailyNet(getDb(), userId, accountIds, from)]);
  const startOf = new Map(start.map((r) => [r.accountId, toNumber(r.balance)]));
  const netOf = new Map(nets.map((r) => [`${r.accountId}|${r.day}`, toNumber(r.net)]));
  const out = new Map<string, { date: string; balance: number }[]>();
  for (const id of accountIds) {
    let bal = startOf.get(id) ?? 0;
    const series = [];
    for (let i = 0; i < days; i++) {
      const date = shiftDays(from, i);
      bal += netOf.get(`${id}|${date}`) ?? 0;
      series.push({ date, balance: Math.round(bal * 100) / 100 });
    }
    out.set(id, series);
  }
  return out;
}


