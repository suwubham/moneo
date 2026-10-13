import "server-only";
import { z } from "zod";
import { AppError, notFound } from "@/lib/core/errors";
import { amountInput, toNumber } from "@/lib/core/money";
import { getDb, unitOfWork } from "@/lib/db";
import { assertCategory } from "@/lib/modules/categories/service";
import { type BudgetProgress, listBudgetProgress, removeBudget, upsertBudget } from "./repository";

export const budgetInput = z.object({
  categoryId: z.uuid("Pick a category."),
  amount: amountInput,
});

export type BudgetStatus = "fine" | "close" | "over";

export function statusOf(b: Pick<BudgetProgress, "amount" | "spent">): { ratio: number; status: BudgetStatus } {
  const limit = toNumber(b.amount);
  const ratio = limit > 0 ? toNumber(b.spent) / limit : 0;
  return { ratio, status: ratio > 1 ? "over" : ratio >= 0.8 ? "close" : "fine" };
}

export function getBudgetProgress(userId: string, range: { start: string; end: string }) {
  return listBudgetProgress(getDb(), userId, range);
}

export async function saveBudget(userId: string, input: z.infer<typeof budgetInput>) {
  return unitOfWork(async (tx) => {
    const category = await assertCategory(userId, input.categoryId, tx);
    if (category?.kind !== "expense") throw new AppError(422, "not_expense_category", "Budgets are for spending categories.");
    return upsertBudget(tx, { userId, ...input });
  });
}

export async function deleteBudget(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeBudget(tx, userId, id))) throw notFound("budget");
  });
}
