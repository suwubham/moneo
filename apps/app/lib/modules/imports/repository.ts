import { sql } from "drizzle-orm";
import type { Conn } from "@/lib/db";

// Holds until the transaction ends, so two imports for one person run one after the other.
export async function lockImports(c: Conn, userId: string) {
  await c.execute(sql`select pg_advisory_xact_lock(hashtext(${`import:${userId}`}))`);
}
