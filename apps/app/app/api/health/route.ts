import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { log } from "@/lib/core/log";
import { getDb } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    log.error("health check failed", undefined, err);
    return Response.json({ error: { code: "db_unavailable", message: "The database is not reachable." } }, { status: 503 });
  }
}
