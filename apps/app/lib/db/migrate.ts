import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export type MigrateResult = "migrated" | "skipped";

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export async function runMigrations(url: string, folder = path.join(process.cwd(), "drizzle")): Promise<void> {
  // One connection, so the session advisory lock and the migrations share it.
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(hashtext('moneo-migrate'))`;
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client`select pg_advisory_unlock(hashtext('moneo-migrate'))`;
  } finally {
    await client.end({ timeout: 5 });
  }
}

type AutoInput = {
  url?: string;
  vercelEnv?: string;
  productionDbHost?: string;
};

// --auto runs before `next dev` and `next build`. Production is migrated by GitHub Actions, never here.
export function autoDecision({ url, vercelEnv, productionDbHost }: AutoInput): { run: boolean; reason: string } {
  if (!url) return { run: false, reason: "no DATABASE_URL" };
  if (vercelEnv === "production") return { run: false, reason: "production migrates from CI" };
  if (vercelEnv === "preview") {
    if (!productionDbHost) return { run: false, reason: "APP_PRODUCTION_DB_HOST is not set, so a preview cannot prove it is safe" };
    if (hostOf(url) === productionDbHost) return { run: false, reason: "preview points at the production database" };
  }
  return { run: true, reason: vercelEnv ? `vercel ${vercelEnv}` : "local" };
}
