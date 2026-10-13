import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { monthOf } from "@/lib/core/dates";
import type { AppError } from "@/lib/core/errors";
import { createAccount, getAccounts } from "./accounts/service";
import { getBudgetProgress, saveBudget, statusOf } from "./budgets/service";
import { getCategories } from "./categories/service";
import { deleteAllData, getProfile } from "./profiles/service";
import { getMonthlyFlow, getSpendingByCategory } from "./reports/service";
import { createTransaction, getTotals, getTransactions } from "./transactions/service";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);
const me = `test_${Date.now()}`;
const other = `${me}_other`;
const oct = monthOf("2026-10");

describe("finance modules against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  before(async () => {
    await getProfile(me);
    await getProfile(other);
  });

  after(async () => {
    await deleteAllData(me);
    await deleteAllData(other);
  });

  test("a new profile gets default categories once, even when asked twice at the same time", async () => {
    const id = `${me}_race`;
    await Promise.all([getProfile(id), getProfile(id)]);
    assert.equal((await getCategories(id)).length, 18);
    await deleteAllData(id);
  });

  test("balances, totals, categories and budgets add up", async () => {
    const acct = await createAccount(me, { name: "Everyday", kind: "checking", openingBalance: "100.00" });
    const cats = await getCategories(me);
    const dining = cats.find((c) => c.name === "Dining")!;
    const salary = cats.find((c) => c.name === "Salary")!;

    const base = { accountId: acct.id, note: null };
    await createTransaction(me, { ...base, categoryId: dining.id, direction: "out", amount: "12.50", occurredOn: "2026-10-02", description: "Corner café" });
    await createTransaction(me, { ...base, categoryId: dining.id, direction: "out", amount: "30.00", occurredOn: "2026-10-05", description: "Noodle bar" });
    await createTransaction(me, { ...base, categoryId: salary.id, direction: "in", amount: "2000.00", occurredOn: "2026-10-01", description: "Payroll" });
    await createTransaction(me, { ...base, categoryId: null, direction: "out", amount: "5.00", occurredOn: "2026-09-30", description: "Parking" });

    const [account] = await getAccounts(me);
    assert.equal(account.balance, "2052.50");
    assert.equal(account.count, 4);

    assert.deepEqual(await getTotals(me, { from: oct.start, to: oct.end }), { count: 3, moneyIn: "2000.00", moneyOut: "42.50" });

    const found = await getTransactions(me, { q: "noodle" }, { limit: 10, offset: 0 });
    assert.equal(found.length, 1);
    assert.equal(found[0].amount, "-30.00");

    const spend = await getSpendingByCategory(me, oct);
    assert.deepEqual(
      spend.map((s) => [s.name, s.spent]),
      [["Dining", "42.50"]],
    );

    assert.deepEqual(await getMonthlyFlow(me, oct, 2), [
      { month: "2026-09", moneyIn: 0, moneyOut: 5 },
      { month: "2026-10", moneyIn: 2000, moneyOut: 42.5 },
    ]);

    await saveBudget(me, { categoryId: dining.id, amount: "50.00" });
    await saveBudget(me, { categoryId: dining.id, amount: "40.00" });
    const [b] = await getBudgetProgress(me, oct);
    assert.equal(b.amount, "40.00");
    assert.equal(b.spent, "42.50");
    assert.equal(statusOf(b).status, "over");
  });

  test("budgets refuse income categories", async () => {
    const salary = (await getCategories(me)).find((c) => c.name === "Salary")!;
    await assert.rejects(saveBudget(me, { categoryId: salary.id, amount: "10" }), (e: AppError) => e.code === "not_expense_category");
  });

  test("nobody can write into someone else's account or read their rows", async () => {
    const [mine] = await getAccounts(me);
    await assert.rejects(
      createTransaction(other, { accountId: mine.id, categoryId: null, direction: "out", amount: "1.00", occurredOn: "2026-10-03", description: "x", note: null }),
      (e: AppError) => e.status === 404,
    );
    assert.equal((await getTransactions(other, {}, { limit: 10, offset: 0 })).length, 0);
  });
});
