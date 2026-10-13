import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "@/lib/modules/transactions/schema";
import { budgets } from "./schema";

export type BudgetProgress = Awaited<ReturnType<typeof listBudgetProgress>>[number];

export function listBudgetProgress(c: Conn, userId: string, range: { start: string; end: string }) {
  const spent = c
    .select({
      categoryId: transactions.categoryId,
      spent: sql<string>`(-sum(${transactions.amount}))::numeric(14,2)`.as("spent"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, range.start),
        lt(transactions.occurredOn, range.end),
        lt(transactions.amount, "0"),
      ),
    )
    .groupBy(transactions.categoryId)
    .as("spent");

  return c
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      amount: budgets.amount,
      spent: sql<string>`coalesce(${spent.spent}, 0)::numeric(14,2)`,
    })
    .from(budgets)
    .innerJoin(categories, eq(categories.id, budgets.categoryId))
    .leftJoin(spent, eq(spent.categoryId, budgets.categoryId))
    .where(eq(budgets.userId, userId))
    .orderBy(asc(categories.name));
}

export async function upsertBudget(c: Conn, row: { userId: string; categoryId: string; amount: string }) {
  const [saved] = await c
    .insert(budgets)
    .values(row)
    .onConflictDoUpdate({ target: [budgets.userId, budgets.categoryId], set: { amount: row.amount, updatedAt: new Date() } })
    .returning();
  return saved;
}

export async function removeBudget(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning({ id: budgets.id });
  return rows.length > 0;
}
