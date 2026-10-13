import { type SQL, and, desc, eq, gt, gte, ilike, isNull, lt, lte, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { accounts } from "@/lib/modules/accounts/schema";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "./schema";

export type TxFilter = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string | "none";
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
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
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
