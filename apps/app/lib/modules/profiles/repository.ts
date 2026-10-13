import { eq } from "drizzle-orm";
import type { Conn } from "@/lib/db";
import { profiles } from "./schema";

export async function findProfile(c: Conn, id: string) {
  const [row] = await c.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return row ?? null;
}

export async function insertProfile(c: Conn, id: string) {
  const [row] = await c.insert(profiles).values({ id }).onConflictDoNothing().returning();
  return row ?? null;
}

export async function updateCurrency(c: Conn, id: string, currency: string) {
  await c.update(profiles).set({ currency }).where(eq(profiles.id, id));
}

export async function deleteProfile(c: Conn, id: string) {
  await c.delete(profiles).where(eq(profiles.id, id));
}
