import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { type FileKind, assistantFiles } from "./schema";

export async function insertFile(
  c: Conn,
  row: { id: string; userId: string; conversationId: string; name: string; kind: FileKind; bytes: number; key: string },
) {
  const [saved] = await c.insert(assistantFiles).values(row).returning();
  return saved;
}

export async function findFile(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(assistantFiles)
    .where(and(eq(assistantFiles.userId, userId), eq(assistantFiles.id, id)))
    .limit(1);
  return row ?? null;
}

export function listFilesForMessages(c: Conn, userId: string, messageIds: string[]) {
  if (messageIds.length === 0) return Promise.resolve([]);
  return c
    .select({
      id: assistantFiles.id,
      messageId: assistantFiles.messageId,
      name: assistantFiles.name,
      kind: assistantFiles.kind,
      bytes: assistantFiles.bytes,
    })
    .from(assistantFiles)
    .where(and(eq(assistantFiles.userId, userId), inArray(assistantFiles.messageId, messageIds)))
    .orderBy(asc(assistantFiles.createdAt));
}

// Files made during a turn are saved before the reply is; this ties them to it.
export async function attachFiles(c: Conn, userId: string, ids: string[], messageId: string) {
  if (ids.length === 0) return;
  await c
    .update(assistantFiles)
    .set({ messageId })
    .where(and(eq(assistantFiles.userId, userId), inArray(assistantFiles.id, ids), isNull(assistantFiles.messageId)));
}

export async function countFilesSince(c: Conn, userId: string, since: Date) {
  const [row] = await c
    .select({ n: sql<number>`count(*)::int` })
    .from(assistantFiles)
    .where(and(eq(assistantFiles.userId, userId), gte(assistantFiles.createdAt, since)));
  return row?.n ?? 0;
}
