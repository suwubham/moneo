import "server-only";
import { type Month, monthLabel, shiftMonth } from "@/lib/core/dates";
import { getBudgetProgress, statusOf } from "@/lib/modules/budgets/service";
import { getMonthlyFlow, getSpendingByCategory } from "@/lib/modules/reports/service";
import { callModel, chatModel } from "./model";
import { visibleText } from "./text";

// A short read of the month from aggregates only; individual transactions never leave for this one.
export async function monthRead(userId: string, currency: string, month: Month, today: string): Promise<string> {
  const prev = shiftMonth(month.key, -1);
  const [flow, now, before, budgets] = await Promise.all([
    getMonthlyFlow(userId, month, 3),
    getSpendingByCategory(userId, month, 8),
    getSpendingByCategory(userId, prev, 8),
    getBudgetProgress(userId, month),
  ]);

  const facts = {
    month: monthLabel(month.key),
    today,
    currency,
    cashFlowLast3Months: flow,
    topSpendingThisMonth: now.map((r) => ({ category: r.name, spent: r.spent })),
    topSpendingLastMonth: before.map((r) => ({ category: r.name, spent: r.spent })),
    budgets: budgets.map((b) => ({ budget: b.name, kind: b.kind, limit: b.amount, spent: b.spent, status: statusOf(b).status })),
  };

  const prompt = `Write a short read of this person's month in money, from these facts only.

${JSON.stringify(facts)}

Rules: two or three plain sentences, second person, no greeting, no lists, no markdown.
Mention the one or two things that changed most or matter most (a budget close to its limit, a category that grew).
If the month is not over yet, say "so far". Say amounts in ${currency}. Do not give advice about investments, tax or products.
If there is almost no data, say that in one friendly sentence and suggest adding a few transactions.`;

  const reply = await callModel("month_read", () => chatModel({ temperature: 0.4 }).invoke(prompt));
  return visibleText(reply.content).trim();
}
