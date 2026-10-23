import { and, asc, eq, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "@/lib/modules/transactions/schema";
import { type BudgetKind, budgetLimits, budgets } from "./schema";

// Which transactions a budget counts. Total and category budgets count money out. A picked budget counts everything
// added to it, so money back on it (a refund, a friend paying their share) lowers what it spent, as in Cashew.
function counts(t: typeof transactions) {
  return sql`case ${budgets.kind}
    when 'picked' then ${t.budgetId} = ${budgets.id}
    when 'total' then ${t.amount} < 0 and not ${t.excludeFromBudgets}
    else ${t.amount} < 0 and ${t.categoryId} = ${budgets.categoryId} and not ${t.excludeFromBudgets}
  end`;
}

export type BudgetProgress = Awaited<ReturnType<typeof listBudgetProgress>>[number];

export function listBudgetProgress(c: Conn, userId: string, range: { start: string; end: string }) {
  const t = transactions;
  // What the month spent against each budget, by its kind (see `counts`). Never below zero.
  const spent = sql<string>`greatest(coalesce((
    select -sum(${t.amount}) from ${t}
    where ${t.userId} = ${budgets.userId}
      and ${t.occurredOn} >= ${range.start} and ${t.occurredOn} < ${range.end}
      and ${counts(t)}
  ), 0), 0)::numeric(14,2)`;

  return c
    .select({
      id: budgets.id,
      kind: budgets.kind,
      categoryId: budgets.categoryId,
      name: sql<string>`coalesce(${budgets.name}, ${categories.name}, 'All spending')`,
      icon: categories.icon,
      color: categories.color,
      // The limit that applied in this month.
      amount: sql<string>`coalesce((
        select ${budgetLimits.amount} from ${budgetLimits}
        where ${budgetLimits.budgetId} = ${budgets.id} and ${budgetLimits.fromMonth} <= ${range.start.slice(0, 7)}
        order by ${budgetLimits.fromMonth} desc limit 1
      ), ${budgets.amount})`,
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
    .select({ budgetId: budgets.id, month, spent: sql<string>`greatest(-sum(${t.amount}), 0)::numeric(14,2)` })
    .from(budgets)
    .innerJoin(
      t,
      and(eq(t.userId, budgets.userId), sql`${t.occurredOn} >= ${range.start} and ${t.occurredOn} < ${range.end}`, counts(t)),
    )
    .where(eq(budgets.userId, userId))
    .groupBy(budgets.id, month);
}

export function listLimits(c: Conn, userId: string) {
  return c
    .select({ budgetId: budgetLimits.budgetId, fromMonth: budgetLimits.fromMonth, amount: budgetLimits.amount })
    .from(budgetLimits)
    .where(eq(budgetLimits.userId, userId))
    .orderBy(asc(budgetLimits.fromMonth));
}

export async function upsertLimit(c: Conn, row: { userId: string; budgetId: string; fromMonth: string; amount: string }) {
  await c
    .insert(budgetLimits)
    .values(row)
    .onConflictDoUpdate({ target: [budgetLimits.budgetId, budgetLimits.fromMonth], set: { amount: row.amount, updatedAt: new Date() } });
}

// The budget a category or total save would land on, if the person already has it.
export async function findBudgetFor(c: Conn, userId: string, where: { kind: "total" } | { kind: "category"; categoryId: string }) {
  const [row] = await c
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        where.kind === "total" ? eq(budgets.kind, "total") : eq(budgets.categoryId, where.categoryId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function listBudgets(c: Conn, userId: string) {
  return c
    .select({ id: budgets.id, kind: budgets.kind, categoryId: budgets.categoryId, name: budgets.name, amount: budgets.amount })
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
