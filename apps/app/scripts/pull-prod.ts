// Copies one person's data from production into the local database, under the local user's id, so a real problem
// can be looked at and fixed locally first. Production is only read. Logs table names and row counts, never data.
//
//   npm run db:pull-prod -- [--from <prod user id>] [--to <local user id>] [--dry-run]
//
// Production comes from .env.prod (`vercel env pull .env.prod --environment=production`), local from .env.local.
// Either id may be left out when that database has exactly one profile. The local user's rows are replaced.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { hostOf } from "../lib/db/migrate";

// Parents before children; deleting the local profile clears the rest through its cascades.
const TABLES = ["profiles", "accounts", "categories", "budgets", "transactions", "conversations", "messages"] as const;

function env(file: string) {
  return parseEnv(readFileSync(file, "utf8")) as Record<string, string | undefined>;
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function pickUser(sql: postgres.Sql, given: string | undefined, where: string) {
  if (given) {
    const [row] = await sql`select id from profiles where id = ${given}`;
    if (!row) throw new Error(`no profile with that id in ${where}`);
    return given;
  }
  const rows = await sql`select p.id, p.created_at, (select count(*)::int from accounts a where a.user_id = p.id) as accounts from profiles p order by p.created_at`;
  if (rows.length === 1) return rows[0].id as string;
  console.log(`${where} has ${rows.length} profiles; pass --${where === "production" ? "from" : "to"} with one of these ids:`);
  for (const r of rows) console.log(`  ${r.id}  created ${new Date(r.created_at).toISOString().slice(0, 10)}  ${r.accounts} accounts`);
  process.exit(1);
}

async function columns(sql: postgres.Sql | postgres.TransactionSql, table: string) {
  const rows = await (sql as postgres.Sql)`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table}`;
  return new Set(rows.map((r) => r.column_name as string));
}

async function main() {
  const prodUrl = env(".env.prod").DATABASE_URL_UNPOOLED || env(".env.prod").DATABASE_URL;
  const localUrl = env(".env.local").DATABASE_URL;
  if (!prodUrl || !localUrl) throw new Error("need DATABASE_URL in both .env.prod and .env.local");
  // Only ever write to this machine.
  if (!["localhost", "127.0.0.1", "::1"].includes(hostOf(localUrl))) throw new Error("the target is not a local database; stopping");
  if (hostOf(prodUrl) === hostOf(localUrl)) throw new Error("source and target are the same database; stopping");

  const prod = postgres(prodUrl, { max: 1 });
  const local = postgres(localUrl, { max: 1 });
  const dry = process.argv.includes("--dry-run");
  try {
    const from = await pickUser(prod, arg("from"), "production");
    const to = await pickUser(local, arg("to"), "local");

    // One read-only snapshot of production, as JSON text so money and dates arrive exactly as stored.
    const data = await prod.begin("isolation level repeatable read read only", async (tx) => {
      const out: { table: string; cols: string[]; json: string; count: number }[] = [];
      for (const table of TABLES) {
        const [prodCols, localCols] = await Promise.all([columns(tx, table), columns(local, table)]);
        // Columns only one side has are left out: local ones take their defaults.
        const cols = [...localCols].filter((c) => prodCols.has(c));
        const owner = table === "profiles" ? "id" : "user_id";
        const [row] = await tx`
          select coalesce(json_agg(t), '[]')::text as json, count(*)::int as count
          from (select ${tx(cols)} from ${tx(table)} where ${tx(owner)} = ${from}) t`;
        out.push({ table, cols, json: row.json, count: row.count });
      }
      return out;
    });

    for (const d of data) console.log(`${d.table.padEnd(14)} ${String(d.count).padStart(6)} rows`);
    if (dry) {
      console.log("dry run: nothing written");
      return;
    }

    await local.begin(async (tx) => {
      await tx`delete from profiles where id = ${to}`;
      for (const d of data) {
        if (d.count === 0) continue;
        const owner = d.table === "profiles" ? "id" : "user_id";
        // Every row moves to the local user's id; everything else is copied as is.
        const pick = d.cols.map((c) => (c === owner ? tx`${to}` : tx`${tx(c)}`));
        const list = pick.reduce((acc, part, i) => (i === 0 ? tx`${part}` : tx`${acc}, ${part}`));
        await tx`
          insert into ${tx(d.table)} (${tx(d.cols)})
          select ${list} from json_populate_recordset(null::${tx(d.table)}, ${d.json}::text::json)`;
      }
    });
    console.log("copied into the local database");
  } finally {
    await prod.end();
    await local.end();
  }
}

main().catch((err) => {
  console.error("pull-prod: failed", err instanceof Error ? err.message : err);
  process.exit(1);
});
