import { and, asc, eq, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { transactions } from "@/lib/modules/transactions/schema";
import { type AccountKind, accounts } from "./schema";

export type AccountWithBalance = Awaited<ReturnType<typeof listAccounts>>[number];

export function listAccounts(c: Conn, userId: string) {
  return c
    .select({
      id: accounts.id,
      name: accounts.name,
      kind: accounts.kind,
      openingBalance: accounts.openingBalance,
      archivedAt: accounts.archivedAt,
      icon: accounts.icon,
      color: accounts.color,
      position: accounts.position,
      balance: sql<string>`(${accounts.openingBalance} + coalesce(sum(${transactions.amount}), 0))::numeric(14,2)`,
      count: sql<number>`count(${transactions.id})::int`,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(sql`${accounts.archivedAt} nulls first`, asc(accounts.position), asc(accounts.createdAt));
}

export async function findAccount(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .limit(1);
  return row ?? null;
}

export async function insertAccount(
  c: Conn,
  row: { userId: string; name: string; kind: AccountKind; openingBalance: string; icon?: string | null; color?: string | null },
) {
  // New accounts go to the end of the person's order.
  const [created] = await c
    .insert(accounts)
    .values({ ...row, position: sql`(select coalesce(max(${accounts.position}) + 1, 0) from ${accounts} where ${accounts.userId} = ${row.userId})` })
    .returning();
  return created;
}

export async function setPositions(c: Conn, userId: string, ids: string[]) {
  for (const [i, id] of ids.entries()) {
    await c
      .update(accounts)
      .set({ position: i })
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)));
  }
}

export async function patchAccount(
  c: Conn,
  userId: string,
  id: string,
  patch: Partial<{ name: string; kind: AccountKind; openingBalance: string; archivedAt: Date | null; icon: string | null; color: string | null }>,
) {
  const [row] = await c
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .returning();
  return row ?? null;
}

export async function removeAccount(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
    .returning({ id: accounts.id });
  return rows.length > 0;
}
