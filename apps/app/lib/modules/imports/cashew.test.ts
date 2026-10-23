import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { AppError } from "@/lib/core/errors";
import { currentMonth, monthOf } from "@/lib/core/dates";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetProgress, saveBudget } from "@/lib/modules/budgets/service";
import { deleteAllData, getProfile } from "@/lib/modules/profiles/service";
import { getTransactions } from "@/lib/modules/transactions/service";
import { readCashew, toLocalDate, toMoney } from "./cashew";
import { importCashew } from "./service";

// The parts of Cashew's schema the importer reads.
function cashewFile(): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "cashew-test-"));
  const path = join(dir, "backup.sql");
  const db = new DatabaseSync(path);
  db.exec(`
    create table wallets (wallet_pk text primary key, name text not null, currency text, "order" integer not null);
    create table categories (category_pk text primary key, name text not null, income integer not null default 0, "order" integer not null,
      icon_name text, colour text);
    create table transactions (transaction_pk text primary key, name text not null, amount real not null, note text not null,
      category_fk text not null, wallet_fk text not null, date_created integer not null, paid integer not null default 0,
      shared_reference_budget_pk text, budget_fks_exclude text);
    create table budgets (budget_pk text primary key, name text not null, amount real not null, category_fks text, wallet_fks text,
      income integer not null default 0, archived integer not null default 0, period_length integer not null,
      reoccurrence integer, is_absolute_spending_limit integer not null default 0, added_transactions_only integer not null default 0,
      "order" integer not null);
    create table category_budget_limits (category_limit_pk text primary key, category_fk text not null, budget_fk text not null, amount real not null);
    insert into budgets values
      ('b1', 'Month', 30000, null, null, 0, 0, 1, 3, 0, 0, 0),
      ('b2', 'Weekly food', 500, '["1"]', null, 0, 0, 1, 2, 0, 0, 1),
      ('b3', 'Bank only', 900, null, '["w2"]', 0, 0, 1, 3, 0, 0, 2),
      ('b4', 'Trip', 8000, null, null, 0, 0, 1, 3, 0, 1, 3);
    insert into category_budget_limits values ('l1', '1', 'b1', 20);
    insert into wallets values ('0', 'Cash', 'npr', 0), ('w2', 'Bank', 'npr', 1);
    insert into categories values ('1', 'Dining', 0, 0, 'popcorn.png', '0xff2196f3'), ('c2', 'Pocket money', 1, 1, null, null);
    insert into transactions values
      ('t1', 'Momo', -250.5, '', '1', '0', 1760545800, 1, 'b4', null),
      ('t2', '', 1000.1, 'from home', 'c2', 'w2', 1760600000, 1, null, null),
      ('t3', 'Momo', -250.5, '', '1', '0', 1760545800, 1, null, '["b1"]'),
      ('t4', 'Gym', -2000, '', '1', 'w2', 1790000000, 0, null, null),
      ('t5', 'Zero', 0, '', '1', '0', 1760600000, 1, null, null);
  `);
  db.close();
  const bytes = readFileSync(path);
  rmSync(dir, { recursive: true });
  return bytes;
}

describe("cashew parser", () => {
  test("rounds float amounts to cents and drops zero", () => {
    assert.equal(toMoney(-12.345), "-12.35");
    assert.equal(toMoney(0.1 + 0.2), "0.30");
    assert.equal(toMoney(0.001), null);
    assert.equal(toMoney(Number.NaN), null);
  });

  test("dates land on the local day", () => {
    // 2025-10-15 22:30 UTC is already the 16th in Kathmandu (UTC+5:45).
    assert.equal(toLocalDate(1760567400, 0), "2025-10-15");
    assert.equal(toLocalDate(1760567400, -345), "2025-10-16");
  });

  test("reads wallets, categories and paid transactions", async () => {
    const data = await readCashew(cashewFile(), -345);
    assert.deepEqual(
      data.wallets.map((w) => [w.name, w.currency]),
      [
        ["Cash", "NPR"],
        ["Bank", "NPR"],
      ],
    );
    assert.deepEqual(
      data.categories.map((c) => [c.name, c.kind]),
      [
        ["Dining", "expense"],
        ["Pocket money", "income"],
      ],
    );
    assert.equal(data.transactions.length, 3);
    assert.equal(data.skipped, 2);
    const income = data.transactions.find((t) => t.amount === "1000.10")!;
    assert.equal(income.description, "Pocket money");
    assert.equal(income.note, "from home");
  });

  test("keeps monthly budgets and turns percent limits into amounts", async () => {
    const { budgets, transactions } = await readCashew(cashewFile(), 0);
    // Dining's limit is 20% of the total; the weekly and wallet-only budgets stay out.
    assert.deepEqual(budgets.list, [
      { kind: "total", key: "b1", amount: "30000.00" },
      { kind: "picked", key: "b4", name: "Trip", amount: "8000.00" },
      { kind: "category", categoryKey: "1", amount: "6000.00" },
    ]);
    assert.equal(budgets.skipped, 2);
    assert.deepEqual(
      transactions.map((t) => [t.budgetKey, t.excludeFromBudgets]),
      [
        ["b4", false],
        [null, true],
        [null, false],
      ],
    );
  });

  test("keeps the icon and colour picked in Cashew", async () => {
    const { categories } = await readCashew(cashewFile(), 0);
    assert.deepEqual([categories[0].icon, categories[0].color], ["film", "blue"]);
    assert.equal(categories[1].icon, "wallet");
  });

  test("refuses files that are not a Cashew backup", async () => {
    await assert.rejects(readCashew(new TextEncoder().encode("insert into x values (1);"), 0), (e: AppError) => e.code === "not_cashew");
    const dir = mkdtempSync(join(tmpdir(), "cashew-test-"));
    const other = new DatabaseSync(join(dir, "x.db"));
    other.exec("create table notes (body text)");
    other.close();
    const bytes = readFileSync(join(dir, "x.db"));
    rmSync(dir, { recursive: true });
    await assert.rejects(readCashew(bytes, 0), (e: AppError) => e.code === "not_cashew");
  });
});

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);
const me = `test_import_${Date.now()}`;

describe("cashew import against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  before(() => getProfile(me));
  after(() => deleteAllData(me));

  test("imports once, then skips what is already there", async () => {
    const file = cashewFile();
    const first = await importCashew(me, file, -345);
    assert.equal(first.imported, 3);
    assert.equal(first.accountsCreated, 2);
    assert.equal(first.categoriesCreated, 1); // Dining is a default category already.
    assert.deepEqual(first.currencies, ["NPR"]);
    assert.equal(first.budgetsAdded, 3);
    assert.equal(first.linked, 1);

    const second = await importCashew(me, file, -345);
    assert.equal(second.imported, 0);
    assert.equal(second.duplicates, 3);
    assert.equal(second.budgetsAdded, 0);
    assert.equal(second.linked, 0);

    const accounts = await getAccounts(me);
    assert.deepEqual(accounts.map((a) => [a.name, a.kind, a.balance]).sort(), [
      ["Bank", "checking", "1000.10"],
      ["Cash", "cash", "-501.00"],
    ]);
    const rows = await getTransactions(me, {}, { limit: 10, offset: 0 });
    assert.ok(rows.every((r) => r.categoryName));

    // One momo is in the trip, the other is left out of the total and Dining.
    const progress = await getBudgetProgress(me, monthOf("2025-10"));
    assert.deepEqual(
      progress.map((b) => [b.kind, b.name, b.amount, b.spent]),
      [
        ["total", "All spending", "30000.00", "250.50"],
        ["picked", "Trip", "8000.00", "250.50"],
        ["category", "Dining", "6000.00", "250.50"],
      ],
    );

    // A limit set in Moneo wins over a later import. It counts from this month on; the old month keeps its limit.
    await saveBudget(me, { kind: "total", amount: "100.00" });
    await importCashew(me, file, -345);
    assert.equal((await getBudgetProgress(me, currentMonth()))[0].amount, "100.00");
    assert.equal((await getBudgetProgress(me, monthOf("2025-10")))[0].amount, "30000.00");
  });

  test("an older import gets its budget links on the next one", async () => {
    const id = `${me}_relink`;
    await getProfile(id);
    const file = cashewFile();
    await importCashew(id, file, -345);
    const [trip] = (await getTransactions(id, {}, { limit: 10, offset: 0 })).filter((r) => r.budgetId);
    const { getDb } = await import("@/lib/db");
    const { transactions } = await import("@/lib/modules/transactions/schema");
    const { eq } = await import("drizzle-orm");
    await getDb().update(transactions).set({ budgetId: null }).where(eq(transactions.id, trip.id));
    assert.equal((await importCashew(id, file, -345)).linked, 1);
    await deleteAllData(id);
  });
});
