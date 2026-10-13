import { autoDecision, hostOf, runMigrations } from "../lib/db/migrate";

const auto = process.argv.includes("--auto");
const url = process.env.APP_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

async function main() {
  if (auto) {
    const d = autoDecision({ url, vercelEnv: process.env.VERCEL_ENV, productionDbHost: process.env.APP_PRODUCTION_DB_HOST });
    if (!d.run) {
      console.log(`migrate: skipped (${d.reason})`);
      return;
    }
  }
  if (!url) throw new Error("DATABASE_URL is not set.");
  const started = Date.now();
  await runMigrations(url);
  console.log(`migrate: up to date on ${hostOf(url)} in ${Date.now() - started} ms`);
}

main().catch((err) => {
  console.error("migrate: failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
