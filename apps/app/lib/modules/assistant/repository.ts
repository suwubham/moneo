import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { type ChangeStatus, type MessageRole, assistantChanges, conversations, messages } from "./schema";

export function listConversations(c: Conn, userId: string, limit = 50) {
  return c
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function findConversation(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.id, id)))
    .limit(1);
  return row ?? null;
}

export async function insertConversation(c: Conn, userId: string, title: string) {
  const [row] = await c.insert(conversations).values({ userId, title }).returning();
  return row;
}

export async function touchConversation(c: Conn, id: string) {
  await c.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
}

export async function removeConversation(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.id, id)))
    .returning({ id: conversations.id });
  return rows.length > 0;
}

export function listMessages(c: Conn, conversationId: string) {
  return c.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function lastMessages(c: Conn, conversationId: string, limit: number) {
  const rows = await c
    .select({ id: messages.id, role: messages.role, content: messages.content, images: messages.images })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function insertMessage(
  c: Conn,
  row: { conversationId: string; userId: string; role: MessageRole; content: string; tools?: string[]; data?: string[]; images?: number },
) {
  const [saved] = await c.insert(messages).values(row).returning();
  return saved;
}

export async function countUserMessagesSince(c: Conn, userId: string, since: Date) {
  const [row] = await c
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.userId, userId), eq(messages.role, "user"), gte(messages.createdAt, since)));
  return row?.n ?? 0;
}

// What earlier turns of this chat saved to its sandbox, oldest first.
export async function savedData(c: Conn, conversationId: string) {
  const rows = await c
    .select({ data: messages.data })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), sql`jsonb_array_length(${messages.data}) > 0`))
    .orderBy(asc(messages.createdAt));
  return rows.flatMap((r) => r.data);
}

export async function conversationIds(c: Conn, userId: string) {
  const rows = await c.select({ id: conversations.id }).from(conversations).where(eq(conversations.userId, userId));
  return rows.map((r) => r.id);
}

export async function insertChanges(c: Conn, rows: (typeof assistantChanges.$inferInsert)[]) {
  if (rows.length) await c.insert(assistantChanges).values(rows);
}

export function listChanges(c: Conn, userId: string, messageIds: string[]) {
  if (!messageIds.length) return Promise.resolve([]);
  return c
    .select()
    .from(assistantChanges)
    .where(and(eq(assistantChanges.userId, userId), inArray(assistantChanges.messageId, messageIds)))
    .orderBy(asc(assistantChanges.createdAt), asc(assistantChanges.id));
}

// Locks the row so two taps on Save cannot both write.
export async function lockChange(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(assistantChanges)
    .where(and(eq(assistantChanges.userId, userId), eq(assistantChanges.id, id)))
    .limit(1)
    .for("update");
  return row ?? null;
}

export async function setChangeStatus(c: Conn, userId: string, id: string, status: ChangeStatus) {
  await c
    .update(assistantChanges)
    .set({ status })
    .where(and(eq(assistantChanges.userId, userId), eq(assistantChanges.id, id)));
}
