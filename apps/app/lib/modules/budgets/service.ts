import "server-only";
import { z } from "zod";
import { type Month, monthLabel, shiftMonth } from "@/lib/core/dates";
import { AppError, notFound } from "@/lib/core/errors";
import { amountInput, toNumber } from "@/lib/core/money";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { assertCategory } from "@/lib/modules/categories/service";
import {
  type BudgetProgress,
  budgetHistory,
  findBudget,
  insertPickedBudget,
  listBudgetProgress,
  listBudgets,
  patchBudget,
  removeBudget,
  upsertCategoryBudget,
  upsertTotalBudget,
} from "./repository";

const budgetName = z.string().trim().min(1, "Give it a name.").max(60);

export const budgetInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("category"), categoryId: z.uuid("Pick a category."), amount: amountInput }),
  z.object({ kind: z.literal("total"), amount: amountInput }),
  z.object({ kind: z.literal("picked"), name: budgetName, amount: amountInput }),
]);

export const budgetUpdate = z.object({ amount: amountInput, name: budgetName.optional() });

export type BudgetStatus = "fine" | "close" | "over";

export function statusOf(b: Pick<BudgetProgress, "amount" | "spent">): { ratio: number; status: BudgetStatus } {
  const limit = toNumber(b.amount);
  const ratio = limit > 0 ? toNumber(b.spent) / limit : 0;
  return { ratio, status: ratio > 1 ? "over" : ratio >= 0.8 ? "close" : "fine" };
}

export function getBudgetProgress(userId: string, range: { start: string; end: string }) {
  return listBudgetProgress(getDb(), userId, range);
}

// Spent per budget for the `months` months ending with `month`, oldest first, gaps as zero.
export async function getBudgetHistory(userId: string, month: Month, months = 6) {
  const first = shiftMonth(month.key, -(months - 1));
  const rows = await budgetHistory(getDb(), userId, { start: first.start, end: month.end });
  const keys = Array.from({ length: months }, (_, i) => shiftMonth(first.key, i).key);
  const spentOf = new Map(rows.map((r) => [`${r.budgetId}|${r.month}`, toNumber(r.spent)]));
  const ids = new Set(rows.map((r) => r.budgetId));
  return (budgetId: string) =>
    keys.map((key) => ({ key, label: monthLabel(key).slice(0, 3).toLowerCase(), spent: ids.has(budgetId) ? (spentOf.get(`${budgetId}|${key}`) ?? 0) : 0 }));
}

// The budgets a transaction can be added to.
export async function getPickedBudgets(userId: string) {
  const rows = await listBudgets(getDb(), userId);
  return rows.flatMap((b) => (b.kind === "picked" && b.name ? [{ id: b.id, name: b.name }] : []));
}

export async function saveBudget(userId: string, input: z.infer<typeof budgetInput>) {
  return unitOfWork(async (tx) => {
    if (input.kind === "total") return upsertTotalBudget(tx, { userId, amount: input.amount });
    if (input.kind === "picked") {
      const row = await insertPickedBudget(tx, { userId, name: input.name, amount: input.amount });
      if (!row) throw new AppError(409, "budget_exists", "You already have a budget with that name.");
      return row;
    }
    const category = await assertCategory(userId, input.categoryId, tx);
    if (category?.kind !== "expense") throw new AppError(422, "not_expense_category", "Budgets are for spending categories.");
    return upsertCategoryBudget(tx, { userId, categoryId: input.categoryId, amount: input.amount });
  });
}

export async function updateBudget(userId: string, id: string, input: z.infer<typeof budgetUpdate>) {
  return unitOfWork(async (tx) => {
    const existing = await findBudget(tx, userId, id);
    if (!existing) throw notFound("budget");
    // Only picked budgets have their own name; the others are named by what they count.
    const name = existing.kind === "picked" ? input.name : undefined;
    try {
      return (await patchBudget(tx, userId, id, { amount: input.amount, ...(name && { name }) }))!;
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === "23505") {
        throw new AppError(409, "budget_exists", "You already have a budget with that name.");
      }
      throw err;
    }
  });
}

export async function deleteBudget(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeBudget(tx, userId, id))) throw notFound("budget");
  });
}

export async function assertPickedBudget(userId: string, id: string | null | undefined, tx?: Tx) {
  if (!id) return null;
  const row = await findBudget(tx ?? getDb(), userId, id);
  if (!row || row.kind !== "picked") throw notFound("budget");
  return row;
}
