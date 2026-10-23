import "server-only";
import { z } from "zod";
import { type Month, currentMonth, monthLabel, shiftMonth } from "@/lib/core/dates";
import { AppError, notFound } from "@/lib/core/errors";
import { amountInput, toNumber } from "@/lib/core/money";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { assertCategory } from "@/lib/modules/categories/service";
import {
  type BudgetProgress,
  budgetHistory,
  findBudget,
  findBudgetFor,
  insertPickedBudget,
  listBudgetProgress,
  listBudgets,
  listLimits,
  patchBudget,
  removeBudget,
  upsertCategoryBudget,
  upsertLimit,
  upsertTotalBudget,
} from "./repository";
import { BASE_MONTH } from "./schema";

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

// `count` months ending with `last`, oldest first. Past a year, labels carry the year so months do not repeat.
function monthKeys(last: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftMonth(last, i - (count - 1)).key).map((key) => {
    const short = monthLabel(key).slice(0, 3).toLowerCase();
    return { key, label: count > 12 ? `${short} ${key.slice(2, 4)}` : short };
  });
}

const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));

// Each budget's limit for any month: the latest change at or before it, or the budget's one amount if it never changed.
async function limitsOf(userId: string) {
  const [rows, all] = await Promise.all([listLimits(getDb(), userId), listBudgets(getDb(), userId)]);
  const changes = new Map<string, { fromMonth: string; amount: number }[]>();
  for (const r of rows) changes.set(r.budgetId, [...(changes.get(r.budgetId) ?? []), { fromMonth: r.fromMonth, amount: toNumber(r.amount) }]);
  const current = new Map(all.map((b) => [b.id, toNumber(b.amount)]));
  return (budgetId: string, key: string) => changes.get(budgetId)?.findLast((c) => c.fromMonth <= key)?.amount ?? current.get(budgetId) ?? 0;
}

// Spent per budget for the `months` months ending with `month`, oldest first, gaps as zero, each with its own limit.
export async function getBudgetHistory(userId: string, month: Month, months = 6) {
  const first = shiftMonth(month.key, -(months - 1));
  const [rows, limitAt] = await Promise.all([budgetHistory(getDb(), userId, { start: first.start, end: month.end }), limitsOf(userId)]);
  const keys = monthKeys(month.key, months);
  const spentOf = new Map(rows.map((r) => [`${r.budgetId}|${r.month}`, toNumber(r.spent)]));
  return (budgetId: string) => keys.map((k) => ({ ...k, spent: spentOf.get(`${budgetId}|${k.key}`) ?? 0, limit: limitAt(budgetId, k.key) }));
}

// Every month from a budget's first spending up to `month`, oldest first, gaps as zero. A budget with nothing
// spent yet shows the last six months.
export async function getFullBudgetHistory(userId: string, month: Month) {
  const [rows, limitAt] = await Promise.all([budgetHistory(getDb(), userId, { start: "1900-01-01", end: month.end }), limitsOf(userId)]);
  const spentOf = new Map(rows.map((r) => [`${r.budgetId}|${r.month}`, toNumber(r.spent)]));
  const firstOf = new Map<string, string>();
  for (const r of rows) if (!firstOf.has(r.budgetId) || r.month < firstOf.get(r.budgetId)!) firstOf.set(r.budgetId, r.month);
  return (budgetId: string) => {
    const first = firstOf.get(budgetId);
    const count = first ? monthIndex(month.key) - monthIndex(first) + 1 : 6;
    return monthKeys(month.key, count).map((k) => ({ ...k, spent: spentOf.get(`${budgetId}|${k.key}`) ?? 0, limit: limitAt(budgetId, k.key) }));
  };
}

// The budgets a transaction can be added to.
export async function getPickedBudgets(userId: string) {
  const rows = await listBudgets(getDb(), userId);
  return rows.flatMap((b) => (b.kind === "picked" && b.name ? [{ id: b.id, name: b.name }] : []));
}

// A new limit counts from this month on; earlier months keep the one they had. The first change also records the
// old amount from BASE_MONTH, since until then budgets.amount stood for every month.
async function recordLimit(tx: Tx, userId: string, budget: { id: string; amount: string }, amount: string) {
  if (toNumber(budget.amount) === toNumber(amount)) return;
  const month = currentMonth().key;
  const changes = await listLimits(tx, userId);
  if (!changes.some((c) => c.budgetId === budget.id)) await upsertLimit(tx, { userId, budgetId: budget.id, fromMonth: BASE_MONTH, amount: budget.amount });
  await upsertLimit(tx, { userId, budgetId: budget.id, fromMonth: month, amount });
}

export async function saveBudget(userId: string, input: z.infer<typeof budgetInput>) {
  return unitOfWork(async (tx) => {
    if (input.kind === "total") {
      const before = await findBudgetFor(tx, userId, { kind: "total" });
      const saved = await upsertTotalBudget(tx, { userId, amount: input.amount });
      if (before) await recordLimit(tx, userId, before, input.amount);
      return saved;
    }
    if (input.kind === "picked") {
      const row = await insertPickedBudget(tx, { userId, name: input.name, amount: input.amount });
      if (!row) throw new AppError(409, "budget_exists", "You already have a budget with that name.");
      return row;
    }
    const category = await assertCategory(userId, input.categoryId, tx);
    if (category?.kind !== "expense") throw new AppError(422, "not_expense_category", "Budgets are for spending categories.");
    const before = await findBudgetFor(tx, userId, { kind: "category", categoryId: input.categoryId });
    const saved = await upsertCategoryBudget(tx, { userId, categoryId: input.categoryId, amount: input.amount });
    if (before) await recordLimit(tx, userId, before, input.amount);
    return saved;
  });
}

export async function updateBudget(userId: string, id: string, input: z.infer<typeof budgetUpdate>) {
  return unitOfWork(async (tx) => {
    const existing = await findBudget(tx, userId, id);
    if (!existing) throw notFound("budget");
    // Only picked budgets have their own name; the others are named by what they count.
    const name = existing.kind === "picked" ? input.name : undefined;
    try {
      const saved = (await patchBudget(tx, userId, id, { amount: input.amount, ...(name && { name }) }))!;
      await recordLimit(tx, userId, existing, input.amount);
      return saved;
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
