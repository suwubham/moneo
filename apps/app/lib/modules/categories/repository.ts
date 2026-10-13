import { and, asc, eq } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { type CategoryKind, categories } from "./schema";

export function listCategories(c: Conn, userId: string) {
  return c
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.kind), asc(categories.name));
}

export async function findCategory(c: Conn, userId: string, id: string) {
  const [row] = await c
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .limit(1);
  return row ?? null;
}

export async function insertCategories(c: Conn, rows: { userId: string; name: string; kind: CategoryKind }[]) {
  return c.insert(categories).values(rows).onConflictDoNothing().returning();
}

export async function removeCategory(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning({ id: categories.id });
  return rows.length > 0;
}
