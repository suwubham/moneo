import "server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isoDate } from "@/lib/core/dates";
import { AppError } from "@/lib/core/errors";
import { type CategoryColor, type CategoryIcon, guessLook, nearestColor } from "@/lib/modules/categories/look";
import type { CategoryKind } from "@/lib/modules/categories/schema";

// Cashew's "export backup" is a whole SQLite database with a .sql name. Amounts are already
// signed the way we store them (negative is money out); dates are Unix seconds.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TRANSACTIONS = 50_000;

export type CashewWallet = { key: string; name: string; currency: string | null };
export type CashewCategory = { key: string; name: string; kind: CategoryKind; icon: CategoryIcon; color: CategoryColor };
export type CashewTransaction = {
  walletKey: string;
  categoryKey: string;
  amount: string;
  occurredOn: string;
  description: string;
  note: string | null;
  // The "added transactions only" budget this was added to in Cashew.
  budgetKey: string | null;
  excludeFromBudgets: boolean;
};
export type CashewBudget =
  // A monthly budget over every category and wallet.
  | { kind: "total"; key: string; amount: string }
  // "Added transactions only": counts what was added to it, whatever the category.
  | { kind: "picked"; key: string; name: string; amount: string }
  // One category, from a single-category budget or a budget's category limits.
  | { kind: "category"; categoryKey: string; amount: string };
export type CashewBudgets = {
  list: CashewBudget[];
  // Weekly, yearly, income, wallet-only and multi-category budgets have no match here.
  skipped: number;
};
export type CashewData = {
  wallets: CashewWallet[];
  categories: CashewCategory[];
  transactions: CashewTransaction[];
  budgets: CashewBudgets;
  // Cashew keeps planned and subscription rows that have not happened yet; we leave them out.
  skipped: number;
};

// Cashew's icon files, by what they show. The person picked these, so they win over a guess from the name.
const cashewIcons: [RegExp, CategoryIcon][] = [
  [/cutlery|restaurant|food|burger|pizza|noodle|bowl/, "utensils"],
  [/coffee|cupcake|cake|tea|donut/, "coffee"],
  [/grocer|cart|basket|vegetable|apple/, "cart"],
  [/tram|bus|train|metro|taxi/, "bus"],
  [/car|vehicle/, "car"],
  [/fuel|gas|petrol/, "fuel"],
  [/house|home|building|rent/, "home"],
  [/electric|bolt|light|bulb|plug/, "bolt"],
  [/wifi|internet|router/, "wifi"],
  [/smartphone|phone|mobile/, "phone"],
  [/health|medical|hospital|heart|stethoscope/, "heart"],
  [/pill|medicine|drug/, "pill"],
  [/shopping|bag|store/, "bag"],
  [/shirt|cloth|dress|tshirt/, "shirt"],
  [/popcorn|movie|film|ticket|game|controller/, "film"],
  [/music|headphone|guitar/, "music"],
  [/subscri|repeat|loop/, "repeat"],
  [/plane|flight|travel|luggage|suitcase|beach/, "plane"],
  [/graduat|school|book|educat/, "school"],
  [/gift|present/, "gift"],
  [/pet|paw|dog|cat/, "paw"],
  [/baby|child|stroller/, "baby"],
  [/gym|dumbbell|fitness|sport/, "dumbbell"],
  [/flower|diamond|sparkle|beauty|makeup|ring/, "sparkles"],
  [/briefcase|work|office/, "briefcase"],
  [/laptop|computer/, "laptop"],
  [/money-bag|coin|money|dollar/, "coins"],
  [/bank|landmark/, "bank"],
  [/piggy|saving/, "piggy"],
  [/undo|refund|receipt|back/, "receipt"],
  [/wallet/, "wallet"],
];

const notCashew = () => new AppError(422, "not_cashew", "That file is not a Cashew backup. Export one from Cashew's settings.");
const MAGIC = "SQLite format 3\0";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Cashew's money is a float; round once here to the two decimals we store. toPrecision strips
// float noise (12.345 * 100 is 1234.4999…) and halves round away from zero, like a person would.
export function toMoney(v: unknown): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const cents = Math.sign(v) * Math.round(Number((Math.abs(v) * 100).toPrecision(15)));
  if (cents === 0 || Math.abs(cents) >= 1e14) return null;
  return (cents / 100).toFixed(2);
}

// tzOffset is the browser's getTimezoneOffset(): minutes to add to local time to get UTC.
export function toLocalDate(seconds: unknown, tzOffset: number): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  const d = new Date(seconds * 1000 - tzOffset * 60_000);
  return Number.isNaN(d.getTime()) ? null : isoDate(d);
}

export async function readCashew(bytes: Uint8Array, tzOffset: number): Promise<CashewData> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new AppError(413, "file_too_large", "That file is over 10 MB.");
  if (new TextDecoder().decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) throw notCashew();

  // node:sqlite opens files only, so the upload sits in a private temp folder for the read.
  const dir = await mkdtemp(join(tmpdir(), "cashew-"));
  const path = join(dir, "backup.db");
  try {
    await writeFile(path, bytes, { mode: 0o600 });
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      return extract(db, tzOffset);
    } finally {
      db.close();
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw notCashew();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function extract(db: DatabaseSync, tzOffset: number): CashewData {
  const tables = new Set(db.prepare("select name from sqlite_master where type = 'table'").all().map((r) => r.name));
  if (!["wallets", "categories", "transactions"].every((t) => tables.has(t))) throw notCashew();

  const count = db.prepare("select count(*) as n from transactions").get()?.n;
  if (typeof count === "number" && count > MAX_TRANSACTIONS) {
    throw new AppError(413, "too_many_transactions", `That backup has more than ${MAX_TRANSACTIONS.toLocaleString("en")} transactions.`);
  }

  const wallets = db
    .prepare(`select wallet_pk, name, currency from wallets order by "order"`)
    .all()
    .map((r) => ({
      key: String(r.wallet_pk),
      name: clip(r.name, 60) || "Wallet",
      currency: typeof r.currency === "string" && /^[a-z]{3}$/i.test(r.currency) ? r.currency.toUpperCase() : null,
    }));

  const categories = db
    .prepare(`select * from categories order by "order"`)
    .all()
    .map((r) => {
      const name = clip(r.name, 40) || "Other";
      const byName = guessLook(name);
      const file = String(r.icon_name ?? "").toLowerCase();
      return {
        key: String(r.category_pk),
        name,
        kind: (r.income === 1 ? "income" : "expense") as CategoryKind,
        icon: cashewIcons.find(([re]) => re.test(file))?.[1] ?? byName.icon,
        color: nearestColor(typeof r.colour === "string" ? r.colour : null) ?? byName.color,
      };
    });

  const categoryNames = new Map(categories.map((c) => [c.key, c.name]));
  const walletKeys = new Set(wallets.map((w) => w.key));
  const transactions: CashewTransaction[] = [];
  let skipped = 0;

  const rows = db
    .prepare("select * from transactions order by date_created")
    .all();
  for (const r of rows) {
    const amount = toMoney(r.amount);
    const occurredOn = toLocalDate(r.date_created, tzOffset);
    const walletKey = String(r.wallet_fk);
    const categoryKey = String(r.category_fk);
    if (r.paid !== 1 || !amount || !occurredOn || !walletKeys.has(walletKey)) {
      skipped++;
      continue;
    }
    const note = clip(r.note, 500);
    transactions.push({
      walletKey,
      categoryKey,
      amount,
      occurredOn,
      description: clip(r.name, 140) || categoryNames.get(categoryKey) || "Imported",
      note: note || null,
      budgetKey: typeof r.shared_reference_budget_pk === "string" ? r.shared_reference_budget_pk : null,
      excludeFromBudgets: keyList(r.budget_fks_exclude).length > 0,
    });
  }

  return { wallets, categories, transactions, budgets: extractBudgets(db, tables), skipped };
}

// Cashew stores id lists as JSON text, e.g. '["1","4"]'.
function keyList(v: unknown): string[] {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    const list: unknown = JSON.parse(v);
    return Array.isArray(list) ? list.map(String) : [];
  } catch {
    return [];
  }
}

const MONTHLY = 3;

function extractBudgets(db: DatabaseSync, tables: Set<unknown>): CashewBudgets {
  const out: CashewBudgets = { list: [], skipped: 0 };
  if (!tables.has("budgets")) return out;

  const seenCategories = new Set<string>();
  const parents = new Map<string, { amount: number; absolute: boolean }>();
  let hasTotal = false;

  for (const b of db.prepare(`select * from budgets where archived = 0 order by "order"`).all()) {
    const amount = toMoney(b.amount);
    const cats = keyList(b.category_fks);
    const isMonthly = b.reoccurrence === MONTHLY && b.period_length === 1 && b.income !== 1;
    if (!isMonthly || !amount || amount.startsWith("-") || keyList(b.wallet_fks).length > 0) {
      out.skipped++;
      continue;
    }
    const key = String(b.budget_pk);
    if (b.added_transactions_only === 1) {
      out.list.push({ kind: "picked", key, name: clip(b.name, 60) || "Budget", amount });
      continue;
    }
    parents.set(key, { amount: b.amount as number, absolute: b.is_absolute_spending_limit === 1 });
    if (cats.length === 0 && !hasTotal) {
      hasTotal = true;
      out.list.push({ kind: "total", key, amount });
    } else if (cats.length === 1 && !seenCategories.has(cats[0])) {
      seenCategories.add(cats[0]);
      out.list.push({ kind: "category", categoryKey: cats[0], amount });
    } else out.skipped++;
  }

  if (tables.has("category_budget_limits")) {
    for (const l of db.prepare("select category_fk, budget_fk, amount from category_budget_limits").all()) {
      const parent = parents.get(String(l.budget_fk));
      if (!parent || typeof l.amount !== "number") continue;
      // Without the absolute flag, Cashew stores the limit as a percent of the budget.
      const amount = toMoney(parent.absolute ? l.amount : (parent.amount * l.amount) / 100);
      const categoryKey = String(l.category_fk);
      if (amount && !amount.startsWith("-") && !seenCategories.has(categoryKey)) {
        seenCategories.add(categoryKey);
        out.list.push({ kind: "category", categoryKey, amount });
      }
    }
  }
  return out;
}
