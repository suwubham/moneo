import { type SQL, and, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  // Money in and out leave transfers out; a transfer is neither.
  direction?: "in" | "out" | "transfer";
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
    f.direction === "out"
      ? and(lt(transactions.amount, "0"), isNull(transactions.transferId))
      : f.direction === "in"
        ? and(gt(transactions.amount, "0"), isNull(transactions.transferId))
        : f.direction === "transfer"
          ? isNotNull(transactions.transferId)
          : undefined,
    f.minAbs != null ? gte(abs, String(f.minAbs)) : undefined,
    f.maxAbs != null ? lte(abs, String(f.maxAbs)) : undefined,
  );
}

// The other row of a transfer, and the account it sits in.
const otherLeg = alias(transactions, "other_leg");
const otherAccount = alias(accounts, "other_account");

export function listTransactions(c: Conn, userId: string, f: TxFilter, page: { limit: number; offset: number }) {
  // Each account's balance after each of its rows, counted over all of them, not just the ones the filter shows.
  const running = c.$with("running").as(
    c
      .select({
        id: transactions.id,
        net: sql<string>`sum(${transactions.amount}) over (partition by ${transactions.accountId} order by ${transactions.occurredOn}, ${transactions.createdAt}, ${transactions.id})`.as(
          "net",
        ),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), f.accountId ? eq(transactions.accountId, f.accountId) : undefined)),
  );
  return c
    .with(running)
    .select({
      id: transactions.id,
      amount: transactions.amount,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      note: transactions.note,
      accountId: transactions.accountId,
      accountName: accounts.name,
      accountKind: accounts.kind,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      budgetId: transactions.budgetId,
      budgetName: budgets.name,
      excludeFromBudgets: transactions.excludeFromBudgets,
      balance: sql<string>`(${accounts.openingBalance} + ${running.net})::numeric(14,2)`,
      transferId: transactions.transferId,
      transferAccountId: otherLeg.accountId,
      transferAccountName: otherAccount.name,
    })
    .from(transactions)
    .innerJoin(running, eq(running.id, transactions.id))
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .leftJoin(budgets, eq(budgets.id, transactions.budgetId))
    .leftJoin(otherLeg, and(eq(otherLeg.transferId, transactions.transferId), ne(otherLeg.id, transactions.id), eq(otherLeg.userId, userId)))
    .leftJoin(otherAccount, eq(otherAccount.id, otherLeg.accountId))
    .where(where(userId, f))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt), desc(transactions.id))
    .limit(page.limit)
    .offset(page.offset);
}

export async function totals(c: Conn, userId: string, f: TxFilter) {
  // Across all accounts a transfer only moves money around, so it is neither in nor out. For one account it is both.
  const counts = f.accountId ? sql`true` : sql`${transactions.transferId} is null`;
  const [row] = await c
    .select({
      count: sql<number>`count(*)::int`,
      moneyIn: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.amount} > 0 and ${counts}), 0)::numeric(14,2)`,
      moneyOut: sql<string>`coalesce(-sum(${transactions.amount}) filter (where ${transactions.amount} < 0 and ${counts}), 0)::numeric(14,2)`,
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

export function findTransferLegs(c: Conn, userId: string, transferId: string) {
  return c
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.transferId, transferId)));
}

export async function removeTransfer(c: Conn, userId: string, transferId: string) {
  const rows = await c
    .delete(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.transferId, transferId)))
    .returning({ id: transactions.id });
  return rows.length > 0;
}

// Links money moved between two of your own accounts that was saved as two loose rows (as Cashew exports it):
// one out and one in on the same day, same amount, same description and category, in different accounts.
// Each row pairs at most once. Returns how many transfers it made.
export async function linkTransferPairs(c: Conn, userId: string) {
  const rows = await c.execute<{ id: string }>(sql`
    with loose as (
      select id, account_id, occurred_on, amount, description, category_id,
        row_number() over (
          partition by occurred_on, abs(amount), description, category_id, sign(amount)
          order by created_at, id
        ) as n
      from ${transactions}
      where user_id = ${userId} and transfer_id is null and amount <> 0
    ),
    pairs as (
      select o.id as out_id, i.id as in_id, gen_random_uuid() as transfer_id
      from loose o
      join loose i
        on i.occurred_on = o.occurred_on and i.amount = -o.amount and i.description = o.description
        and i.category_id is not distinct from o.category_id and i.n = o.n and i.account_id <> o.account_id
      where o.amount < 0
    )
    update ${transactions} t
    set transfer_id = p.transfer_id, exclude_from_budgets = true
    from pairs p
    where t.user_id = ${userId} and t.id in (p.out_id, p.in_id)
    returning t.id`);
  return rows.length / 2;
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
