import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { categories } from "@/lib/modules/categories/schema";
import { transactions } from "@/lib/modules/transactions/schema";

type Range = { start: string; end: string };

export function spendingByCategory(c: Conn, userId: string, r: Range, limit = 20) {
  const spent = sql<string>`(-sum(${transactions.amount}))::numeric(14,2)`;
  return c
    .select({
      categoryId: transactions.categoryId,
      name: sql<string>`coalesce(${categories.name}, 'Uncategorised')`,
      spent,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, r.start),
        lt(transactions.occurredOn, r.end),
        lt(transactions.amount, "0"),
      ),
    )
    .groupBy(transactions.categoryId, categories.name)
    .orderBy(desc(spent))
    .limit(limit);
}

export function monthlyFlow(c: Conn, userId: string, r: Range) {
  const month = sql<string>`to_char(${transactions.occurredOn}, 'YYYY-MM')`;
  return c
    .select({
      month,
      moneyIn: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0), 0)::numeric(14,2)`,
      moneyOut: sql<string>`coalesce(-sum(${transactions.amount}) filter (where ${transactions.amount} < 0), 0)::numeric(14,2)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.occurredOn, r.start), lt(transactions.occurredOn, r.end)))
    .groupBy(month)
    .orderBy(month);
}
