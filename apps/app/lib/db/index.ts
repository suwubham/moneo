import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { settings } from "@/lib/core/config";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Conn = Db | Tx;

function connect(): Db {
  if (!settings.databaseUrl) throw new Error("DATABASE_URL is not set.");
  // prepare: false because Neon's pooled endpoint runs PgBouncer in transaction mode.
  const client = postgres(settings.databaseUrl, { max: 5, prepare: false, idle_timeout: 20 });
  return drizzle(client, { schema });
}

// Dev hot reload re-evaluates modules; keep one pool instead of leaking a new one each time.
const g = globalThis as unknown as { __moneoDb?: Db };

// Lazy so `next build` can load route modules without a database.
export function getDb(): Db {
  g.__moneoDb ??= connect();
  return g.__moneoDb;
}

// One transaction per request: actions and route handlers wrap their writes in this.
export function unitOfWork<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}
