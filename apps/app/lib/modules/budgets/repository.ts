import { and, asc, eq, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "@/lib/modules/transactions/schema";
import { type BudgetKind, budgets } from "./schema";

export type BudgetProgress = Awaited<ReturnType<typeof listBudgetProgress>>[number];

export function listBudgetProgress(c: Conn, userId: string, range: { start: string; end: string }) {
  const t = transactions;
  // Money out in the month that counts towards each budget, by its kind.
  const spent = sql<string>`coalesce((
    select -sum(${t.amount}) from ${t}
    where ${t.userId} = ${budgets.userId}
      and ${t.occurredOn} >= ${range.start} and ${t.occurredOn} < ${range.end}
      and ${t.amount} < 0
      and case ${budgets.kind}
        when 'picked' then ${t.budgetId} = ${budgets.id}
        when 'total' then not ${t.excludeFromBudgets}
        else ${t.categoryId} = ${budgets.categoryId} and not ${t.excludeFromBudgets}
      end
  ), 0)::numeric(14,2)`;

  return c
    .select({
      id: budgets.id,
      kind: budgets.kind,
      categoryId: budgets.categoryId,
      name: sql<string>`coalesce(${budgets.name}, ${categories.name}, 'All spending')`,
      icon: categories.icon,
      color: categories.color,
      amount: budgets.amount,
      spent,
    })
    .from(budgets)
    .leftJoin(categories, eq(categories.id, budgets.categoryId))
    .where(eq(budgets.userId, userId))
    .orderBy(sql`case ${budgets.kind} when 'total' then 0 when 'picked' then 1 else 2 end`, sql`lower(coalesce(${budgets.name}, ${categories.name}))`);
}

// Spent per budget per month over a range, with the same counting rules as listBudgetProgress.
export function budgetHistory(c: Conn, userId: string, range: { start: string; end: string }) {
  const t = transactions;
  const month = sql<string>`to_char(${t.occurredOn}, 'YYYY-MM')`;
  return c
    .select({ budgetId: budgets.id, month, spent: sql<string>`(-sum(${t.amount}))::numeric(14,2)` })
    .from(budgets)
    .innerJoin(
      t,
      and(
        eq(t.userId, budgets.userId),
        sql`${t.occurredOn} >= ${range.start} and ${t.occurredOn} < ${range.end} and ${t.amount} < 0`,
        sql`case ${budgets.kind}
          when 'picked' then ${t.budgetId} = ${budgets.id}
          when 'total' then not ${t.excludeFromBudgets}
          else ${t.categoryId} = ${budgets.categoryId} and not ${t.excludeFromBudgets}
        end`,
      ),
    )
    .where(eq(budgets.userId, userId))
    .groupBy(budgets.id, month);
}

export function listBudgets(c: Conn, userId: string) {
  return c
    .select({ id: budgets.id, kind: budgets.kind, categoryId: budgets.categoryId, name: budgets.name })
    .from(budgets)
    .where(eq(budgets.userId, userId))
    .orderBy(asc(budgets.name));
}

export async function findBudget(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertCategoryBudget(c: Conn, row: { userId: string; categoryId: string; amount: string }) {
  const [saved] = await c
    .insert(budgets)
    .values({ ...row, kind: "category" })
    .onConflictDoUpdate({ target: [budgets.userId, budgets.categoryId], set: { amount: row.amount, updatedAt: new Date() } })
    .returning();
  return saved;
}

export async function upsertTotalBudget(c: Conn, row: { userId: string; amount: string }) {
  const [saved] = await c
    .insert(budgets)
    .values({ ...row, kind: "total" })
    .onConflictDoUpdate({
      target: budgets.userId,
      targetWhere: sql`${budgets.kind} = 'total'`,
      set: { amount: row.amount, updatedAt: new Date() },
    })
    .returning();
  return saved;
}

// Returns null when the person already has a picked budget with that name.
export async function insertPickedBudget(c: Conn, row: { userId: string; name: string; amount: string }) {
  const [saved] = await c
    .insert(budgets)
    .values({ ...row, kind: "picked" })
    .onConflictDoNothing()
    .returning();
  return saved ?? null;
}

// For imports: adds what is missing and leaves budgets the person already has alone.
export async function insertMissingBudgets(
  c: Conn,
  rows: { userId: string; kind: BudgetKind; categoryId?: string | null; name?: string | null; amount: string }[],
) {
  if (rows.length === 0) return [];
  return c.insert(budgets).values(rows).onConflictDoNothing().returning({ id: budgets.id, kind: budgets.kind, name: budgets.name });
}

export async function patchBudget(c: Conn, userId: string, id: string, patch: { amount: string; name?: string }) {
  const [row] = await c
    .update(budgets)
    .set(patch)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning();
  return row ?? null;
}

export async function removeBudget(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.id, id)))
    .returning({ id: budgets.id });
  return rows.length > 0;
}
