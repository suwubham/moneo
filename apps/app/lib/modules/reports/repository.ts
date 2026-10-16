import { and, desc, eq, gte, inArray, lt, not, sql } from "drizzle-orm";
import { accounts } from "@/lib/modules/accounts/schema";
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
      icon: categories.icon,
      color: categories.color,
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
        // Transfers marked "leave out of budgets" are not spending.
        not(transactions.excludeFromBudgets),
      ),
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon, categories.color)
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
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, r.start),
        lt(transactions.occurredOn, r.end),
        not(transactions.excludeFromBudgets),
      ),
    )
    .groupBy(month)
    .orderBy(month);
}

export function dailySpend(c: Conn, userId: string, r: Range) {
  return c
    .select({
      day: transactions.occurredOn,
      spent: sql<string>`(-sum(${transactions.amount}))::numeric(14,2)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, r.start),
        lt(transactions.occurredOn, r.end),
        lt(transactions.amount, "0"),
        not(transactions.excludeFromBudgets),
      ),
    )
    .groupBy(transactions.occurredOn)
    .orderBy(transactions.occurredOn);
}

// Net change per account per day from `from` on, plus each account's balance just before it.
export function dailyNet(c: Conn, userId: string, accountIds: string[], from: string) {
  return c
    .select({
      accountId: transactions.accountId,
      day: transactions.occurredOn,
      net: sql<string>`sum(${transactions.amount})::numeric(14,2)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.accountId, accountIds), gte(transactions.occurredOn, from)))
    .groupBy(transactions.accountId, transactions.occurredOn)
    .orderBy(transactions.occurredOn);
}

export function balancesBefore(c: Conn, userId: string, from: string) {
  return c
    .select({
      accountId: accounts.id,
      balance: sql<string>`(${accounts.openingBalance} + coalesce(sum(${transactions.amount}) filter (where ${transactions.occurredOn} < ${from}), 0))::numeric(14,2)`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id);
}
