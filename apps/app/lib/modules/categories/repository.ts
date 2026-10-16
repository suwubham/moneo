import { and, asc, eq, isNull, sql } from "drizzle-orm";
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

export async function insertCategories(
  c: Conn,
  rows: { userId: string; name: string; kind: CategoryKind; icon?: string | null; color?: string | null }[],
) {
  return c.insert(categories).values(rows).onConflictDoNothing().returning();
}

export async function patchCategory(c: Conn, userId: string, id: string, patch: { name: string; icon: string; color: string }) {
  const [row] = await c
    .update(categories)
    .set(patch)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning();
  return row ?? null;
}

// For imports: gives a look to categories that have none yet, matched by name.
export async function fillLook(c: Conn, userId: string, rows: { name: string; icon: string; color: string }[]) {
  for (const r of rows) {
    await c
      .update(categories)
      .set({ icon: r.icon, color: r.color })
      .where(and(eq(categories.userId, userId), sql`lower(${categories.name}) = lower(${r.name})`, isNull(categories.icon)));
  }
}

export async function removeCategory(c: Conn, userId: string, id: string) {
  const rows = await c
    .delete(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, id)))
    .returning({ id: categories.id });
  return rows.length > 0;
}
