import "server-only";
import { z } from "zod";
import type { Month } from "@/lib/core/dates";
import { getBudgetProgress } from "@/lib/modules/budgets/service";
import { getAverageSpend } from "@/lib/modules/reports/service";
import { callModel, chatModel } from "./model";

const suggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        categoryId: z.string(),
        amount: z.number().describe("Suggested monthly limit, rounded to a tidy number"),
        reason: z.string().describe("One short plain sentence"),
      }),
    )
    .max(8),
});

export type BudgetSuggestion = { categoryId: string; name: string; amount: string; average: number; reason: string };

export async function suggestBudgets(userId: string, currency: string, month: Month): Promise<BudgetSuggestion[]> {
  const [averages, existing] = await Promise.all([getAverageSpend(userId, month, 3), getBudgetProgress(userId, month)]);
  const taken = new Set(existing.map((b) => b.categoryId));
  const open = averages.filter((a) => !taken.has(a.categoryId) && a.average > 0);
  if (open.length === 0) return [];

  const prompt = `Suggest monthly budgets for spending categories that do not have one yet.

Average monthly spend over the last 3 full months, in ${currency}:
${JSON.stringify(open)}

Rules: only use categoryIds from the list. Suggest a limit close to the average, rounded to a tidy number,
a little under it where the spend looks flexible (dining, shopping, entertainment) and at it for fixed costs.
Skip categories with tiny averages. The reason is one short plain sentence, no advice about investments or products.`;

  const out = await callModel("budget_suggest", () =>
    chatModel({ temperature: 0.2 }).withStructuredOutput(suggestionSchema, { name: "budget_suggestions" }).invoke(prompt),
  );

  const byId = new Map(open.map((a) => [a.categoryId, a]));
  return out.suggestions
    .filter((s) => byId.has(s.categoryId) && Number.isFinite(s.amount) && s.amount > 0)
    .map((s) => {
      const a = byId.get(s.categoryId)!;
      return { categoryId: s.categoryId, name: a.name, amount: s.amount.toFixed(2), average: a.average, reason: s.reason.slice(0, 200) };
    });
}
