import { type SQL, and, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { accounts } from "@/lib/modules/accounts/schema";
import { budgets } from "@/lib/modules/budgets/schema";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "./schema";

export type TxFilter = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string | "none";
  budgetId?: string;
  q?: string;
  direction?: "in" | "out";
  minAbs?: number;
  maxAbs?: number;
};

export type TxRow = Awaited<ReturnType<typeof listTransactions>>[number];

function where(userId: string, f: TxFilter): SQL | undefined {
  const abs = sql`abs(${transactions.amount})`;
  return and(
    eq(transactions.userId, userId),
    f.from ? gte(transactions.occurredOn, f.from) : undefined,
    f.to ? lt(transactions.occurredOn, f.to) : undefined,
    f.accountId ? eq(transactions.accountId, f.accountId) : undefined,
    f.categoryId === "none" ? isNull(transactions.categoryId) : f.categoryId ? eq(transactions.categoryId, f.categoryId) : undefined,
    f.budgetId ? eq(transactions.budgetId, f.budgetId) : undefined,
    f.q ? ilike(transactions.description, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    f.direction === "out" ? lt(transactions.amount, "0") : f.direction === "in" ? gt(transactions.amount, "0") : undefined,
    f.minAbs != null ? gte(abs, String(f.minAbs)) : undefined,
    f.maxAbs != null ? lte(abs, String(f.maxAbs)) : undefined,
  );
}

export function listTransactions(c: Conn, userId: string, f: TxFilter, page: { limit: number; offset: number }) {
  return c
    .select({
      id: transactions.id,
      amount: transactions.amount,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      note: transactions.note,
      accountId: transactions.accountId,
      accountName: accounts.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      budgetId: transactions.budgetId,
      budgetName: budgets.name,
      excludeFromBudgets: transactions.excludeFromBudgets,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(budgets, eq(budgets.id, transactions.budgetId))
    .where(where(userId, f))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(page.limit)
    .offset(page.offset);
}

export async function totals(c: Conn, userId: string, f: TxFilter) {
  const [row] = await c
    .select({
      count: sql<number>`count(*)::int`,
      moneyIn: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0), 0)::numeric(14,2)`,
      moneyOut: sql<string>`coalesce(-sum(${transactions.amount}) filter (where ${transactions.amount} < 0), 0)::numeric(14,2)`,
    })
    .from(transactions)
    .where(where(userId, f));
  return row;
}

export async function insertTransaction(c: Conn, row: typeof transactions.$inferInsert) {
  const [created] = await c.insert(transactions).values(row).returning();
  return created;
}

// For offline sync: the device picked the id, so a retry of the same create inserts nothing.
export async function insertTransactionOnce(c: Conn, row: typeof transactions.$inferInsert & { id: string }) {
  const [created] = await c.insert(transactions).values(row).onConflictDoNothing({ target: transactions.id }).returning();
  return created ?? null;
}

export async function findTransaction(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .limit(1);
  return row ?? null;
}

export async function insertTransactions(c: Conn, rows: (typeof transactions.$inferInsert)[]) {
  for (let i = 0; i < rows.length; i += 1000) await c.insert(transactions).values(rows.slice(i, i + 1000));
}

// What an import compares against to skip rows it already brought in.
export function listForMatching(c: Conn, userId: string, accountIds: string[], range: { from: string; to: string }) {
  return c
    .select({
      id: transactions.id,
      budgetId: transactions.budgetId,
      excludeFromBudgets: transactions.excludeFromBudgets,
      accountId: transactions.accountId,
      occurredOn: transactions.occurredOn,
      amount: transactions.amount,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(transactions.accountId, accountIds),
        gte(transactions.occurredOn, range.from),
        lte(transactions.occurredOn, range.to),
      ),
    );
}

// For imports: fills in budget links and exclusions on rows that were brought in before.
export async function setBudgetFor(c: Conn, userId: string, budgetId: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await c
      .update(transactions)
      .set({ budgetId })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids.slice(i, i + 1000))));
  }
}

export async function setExcluded(c: Conn, userId: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await c
      .update(transactions)
      .set({ excludeFromBudgets: true })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids.slice(i, i + 1000))));
  }
}

export async function patchTransaction(c: Conn, userId: string, id: string, patch: Partial<typeof transactions.$inferInsert>) {
  const [row] = await c
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning();
  return row ?? null;
}

export async function removeTransaction(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning({ id: transactions.id });
  return rows.length > 0;
}

export async function recentDescriptions(c: Conn, userId: string, limit = 40) {
  return c
    .select({ description: transactions.description, categoryName: categories.name })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}
