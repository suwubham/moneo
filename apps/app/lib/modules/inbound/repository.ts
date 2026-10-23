import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { inboxEmails, inboxes, inboxHints } from "./schema";

export async function findInbox(c: Conn, userId: string) {
  const [row] = await c.select().from(inboxes).where(eq(inboxes.userId, userId)).limit(1);
  return row ?? null;
}

// The one lookup not scoped to a user: a webhook names an address, and the address tells us whose it is.
export async function findInboxByTokens(c: Conn, tokens: string[]) {
  if (tokens.length === 0) return null;
  const [row] = await c.select().from(inboxes).where(inArray(inboxes.token, tokens)).limit(1);
  return row ?? null;
}

export async function upsertInbox(c: Conn, userId: string, token: string) {
  const [row] = await c
    .insert(inboxes)
    .values({ userId, token })
    .onConflictDoUpdate({ target: inboxes.userId, set: { token } })
    .returning();
  return row;
}

export function listHints(c: Conn, userId: string) {
  return c
    .select({ id: inboxHints.id, subject: inboxHints.subject, hint: inboxHints.hint })
    .from(inboxHints)
    .where(eq(inboxHints.userId, userId))
    .orderBy(asc(sql`lower(${inboxHints.subject})`));
}

export async function insertHint(c: Conn, row: typeof inboxHints.$inferInsert) {
  const [created] = await c.insert(inboxHints).values(row).onConflictDoNothing().returning();
  return created ?? null;
}

export async function patchHint(c: Conn, userId: string, id: string, patch: Partial<typeof inboxHints.$inferInsert>) {
  const [row] = await c
    .update(inboxHints)
    .set(patch)
    .where(and(eq(inboxHints.userId, userId), eq(inboxHints.id, id)))
    .returning();
  return row ?? null;
}

export async function removeHint(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(inboxHints)
    .where(and(eq(inboxHints.userId, userId), eq(inboxHints.id, id)))
    .returning({ id: inboxHints.id });
  return rows.length > 0;
}

export async function emailSeen(c: Conn, providerId: string) {
  const [row] = await c.select({ id: inboxEmails.id }).from(inboxEmails).where(eq(inboxEmails.providerId, providerId)).limit(1);
  return Boolean(row);
}

// Returns null when this email was already saved, by a webhook that raced this one.
export async function insertEmailOnce(c: Conn, row: typeof inboxEmails.$inferInsert) {
  const [created] = await c.insert(inboxEmails).values(row).onConflictDoNothing({ target: inboxEmails.providerId }).returning();
  return created ?? null;
}

export function listEmails(c: Conn, userId: string, limit = 30) {
  return c
    .select()
    .from(inboxEmails)
    .where(eq(inboxEmails.userId, userId))
    .orderBy(desc(inboxEmails.createdAt))
    .limit(limit);
}

export async function findEmail(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(inboxEmails)
    .where(and(eq(inboxEmails.userId, userId), eq(inboxEmails.id, id)))
    .limit(1);
  return row ?? null;
}

export async function patchEmail(c: Conn, userId: string, id: string, patch: Partial<typeof inboxEmails.$inferInsert>) {
  const [row] = await c
    .update(inboxEmails)
    .set(patch)
    .where(and(eq(inboxEmails.userId, userId), eq(inboxEmails.id, id)))
    .returning();
  return row ?? null;
}
