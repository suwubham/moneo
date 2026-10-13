import "server-only";
import { type Month, shiftMonth } from "@/lib/core/dates";
import { toNumber } from "@/lib/core/money";
import { getDb } from "@/lib/db";
import { getAccounts } from "@/lib/modules/accounts/service";
import { monthlyFlow, spendingByCategory } from "./repository";

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
