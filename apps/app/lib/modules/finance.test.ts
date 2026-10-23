import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { currentMonth, monthOf, shiftMonth } from "@/lib/core/dates";
import type { AppError } from "@/lib/core/errors";
import { balanceSplit } from "./accounts/constants";
import { createAccount, getAccounts, updateAccount } from "./accounts/service";
import { getBudgetHistory, getBudgetProgress, saveBudget, statusOf, updateBudget } from "./budgets/service";
import { getCategories } from "./categories/service";
import { deleteAllData, getProfile } from "./profiles/service";
import { getMonthlyFlow, getSpendingByCategory } from "./reports/service";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTotals,
  getTransactions,
  linkTransfers,
  updateTransaction,
  updateTransfer,
} from "./transactions/service";

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

    await saveBudget(me, { kind: "category", categoryId: dining.id, amount: "50.00" });
    await saveBudget(me, { kind: "category", categoryId: dining.id, amount: "40.00" });
    const [b] = await getBudgetProgress(me, oct);
    assert.equal(b.amount, "40.00");
    assert.equal(b.spent, "42.50");
    assert.equal(statusOf(b).status, "over");
  });

  test("total and picked budgets count the right transactions", async () => {
    const id = `${me}_kinds`;
    await getProfile(id);
    const acct = await createAccount(id, { name: "Card", kind: "credit", openingBalance: "0" });
    const dining = (await getCategories(id)).find((c) => c.name === "Dining")!;
    await saveBudget(id, { kind: "total", amount: "1000" });
    await saveBudget(id, { kind: "category", categoryId: dining.id, amount: "100" });
    const trip = await saveBudget(id, { kind: "picked", name: "Trip", amount: "500" });
    await assert.rejects(saveBudget(id, { kind: "picked", name: "trip", amount: "1" }), (e: AppError) => e.code === "budget_exists");
    const gifts = await saveBudget(id, { kind: "picked", name: "Gifts", amount: "50" });
    await assert.rejects(updateBudget(id, gifts.id, { amount: "50", name: "TRIP" }), (e: AppError) => e.code === "budget_exists");

    const base = { accountId: acct.id, note: null, direction: "out" as const, occurredOn: "2026-10-04" };
    await createTransaction(id, { ...base, categoryId: dining.id, amount: "40.00", description: "Dinner", budgetId: trip.id });
    await createTransaction(id, { ...base, categoryId: dining.id, amount: "10.00", description: "Snack" });
    await createTransaction(id, { ...base, categoryId: null, amount: "300.00", description: "To savings", excludeFromBudgets: true });
    // Money back on a picked budget lowers what it spent; it does not touch the other budgets.
    await createTransaction(id, { ...base, direction: "in", categoryId: null, amount: "15.00", description: "Friend paid their share", budgetId: trip.id });

    const got = await getBudgetProgress(id, oct);
    assert.deepEqual(
      got.map((b) => [b.name, b.spent]),
      [
        ["All spending", "50.00"],
        ["Gifts", "0.00"],
        ["Trip", "25.00"],
        ["Dining", "50.00"],
      ],
    );

    // Only picked budgets can hold transactions, and only your own.
    const total = got.find((b) => b.kind === "total")!;
    await assert.rejects(
      createTransaction(id, { ...base, categoryId: null, amount: "1.00", description: "x", budgetId: total.id }),
      (e: AppError) => e.status === 404,
    );
    await assert.rejects(
      createTransaction(other, { ...base, accountId: (await getAccounts(other))[0]?.id ?? acct.id, categoryId: null, amount: "1.00", description: "x", budgetId: trip.id }),
      (e: AppError) => e.status === 404,
    );
    await deleteAllData(id);
  });

  test("transfers move money between accounts and every row shows the balance after it", async () => {
    const id = `${me}_transfer`;
    await getProfile(id);
    const everyday = await createAccount(id, { name: "Everyday", kind: "checking", openingBalance: "100.00" });
    const savings = await createAccount(id, { name: "Savings", kind: "savings", openingBalance: "0" });
    const base = { accountId: everyday.id, categoryId: null, note: null };
    await createTransaction(id, { ...base, direction: "in", amount: "500.00", occurredOn: "2026-10-01", description: "Payroll" });
    await createTransaction(id, { ...base, direction: "out", amount: "20.00", occurredOn: "2026-10-03", description: "Lunch" });
    const move = { fromAccountId: everyday.id, toAccountId: savings.id, amount: "200.00", occurredOn: "2026-10-02", description: "Transfer", note: null };
    const { transferId } = await createTransfer(id, move);

    const balances = Object.fromEntries((await getAccounts(id)).map((a) => [a.name, a.balance]));
    assert.deepEqual(balances, { Everyday: "380.00", Savings: "200.00" });

    // Each row carries its own account's balance just after it. The two sides of a transfer share a time, so sort to compare.
    const rows = await getTransactions(id, {}, { limit: 10, offset: 0 });
    assert.deepEqual(
      rows.map((r) => [r.description, r.amount, r.balance, r.transferAccountName]).sort(),
      [
        ["Lunch", "-20.00", "380.00", null],
        ["Payroll", "500.00", "600.00", null],
        ["Transfer", "-200.00", "400.00", "Savings"],
        ["Transfer", "200.00", "200.00", "Everyday"],
      ],
    );
    assert.deepEqual([rows[0].description, rows[3].description], ["Lunch", "Payroll"]);
    // A filter hides rows but not the balance they built up.
    const [lunch] = await getTransactions(id, { q: "lunch" }, { limit: 10, offset: 0 });
    assert.equal(lunch.balance, "380.00");

    // Across accounts a transfer is neither in nor out; for one account it is.
    assert.deepEqual(await getTotals(id, { from: oct.start, to: oct.end }), { count: 4, moneyIn: "500.00", moneyOut: "20.00" });
    assert.deepEqual(await getTotals(id, { from: oct.start, to: oct.end, accountId: everyday.id }), { count: 3, moneyIn: "500.00", moneyOut: "220.00" });
    assert.deepEqual(await getSpendingByCategory(id, oct), [{ categoryId: null, name: "Uncategorised", icon: null, color: null, spent: "20.00", count: 1 }]);

    // Its rows change only through the transfer, together.
    const leg = rows.find((r) => r.transferId && r.amount === "200.00")!;
    await assert.rejects(
      updateTransaction(id, leg.id, { ...base, accountId: savings.id, direction: "in", amount: "1.00", occurredOn: "2026-10-02", description: "x" }),
      (e: AppError) => e.code === "part_of_transfer",
    );
    await updateTransfer(id, transferId, { ...move, amount: "50.00" });
    assert.deepEqual(Object.fromEntries((await getAccounts(id)).map((a) => [a.name, a.balance])), { Everyday: "530.00", Savings: "50.00" });
    await assert.rejects(createTransfer(id, { ...move, toAccountId: everyday.id }));
    await assert.rejects(createTransfer(other, move), (e: AppError) => e.status === 404);

    // Deleting one side deletes both.
    await deleteTransaction(id, leg.id);
    assert.equal((await getTransactions(id, {}, { limit: 10, offset: 0 })).length, 2);
    await deleteAllData(id);
  });

  test("a credit card holds what you owe: spending when you buy, a transfer when you pay", async () => {
    const id = `${me}_card`;
    await getProfile(id);
    const bank = await createAccount(id, { name: "Bank", kind: "checking", openingBalance: "1000.00" });
    // Typed as a plain amount; saved as owed.
    const card = await createAccount(id, { name: "Card", kind: "credit", openingBalance: "250.00" });
    assert.equal(card.openingBalance, "-250.00");
    await updateAccount(id, card.id, { name: "Card", kind: "credit", openingBalance: "-250.00" });

    const dining = (await getCategories(id)).find((c) => c.name === "Dining")!;
    await createTransaction(id, { accountId: card.id, categoryId: dining.id, direction: "out", amount: "50.00", occurredOn: "2026-10-04", description: "Dinner", note: null });
    await createTransfer(id, { fromAccountId: bank.id, toAccountId: card.id, amount: "300.00", occurredOn: "2026-10-20", description: "Card payment", note: null });

    const accounts = await getAccounts(id);
    assert.deepEqual(Object.fromEntries(accounts.map((a) => [a.name, a.balance])), { Bank: "700.00", Card: "0.00" });
    assert.deepEqual(balanceSplit(accounts), { have: 700, owed: 0, net: 700, hasOwed: true });
    // The dinner is spending once, when it was bought; paying the card is neither in nor out.
    assert.deepEqual(await getTotals(id, { from: oct.start, to: oct.end }), { count: 3, moneyIn: "0.00", moneyOut: "50.00" });
    assert.deepEqual(
      (await getSpendingByCategory(id, oct)).map((r) => [r.name, r.spent]),
      [["Dining", "50.00"]],
    );
    await deleteAllData(id);
  });

  test("have, owe and net keep cards and loans apart", () => {
    assert.deepEqual(
      balanceSplit([
        { kind: "checking", balance: "1200.10" },
        { kind: "savings", balance: "300.20" },
        { kind: "credit", balance: "-450.30" },
        { kind: "loan", balance: "-1000.00" },
      ]),
      { have: 1500.3, owed: 1450.3, net: 50, hasOwed: true },
    );
    assert.equal(balanceSplit([{ kind: "cash", balance: "5" }]).hasOwed, false);
    // A card in credit adds to what you have; "you owe" never goes below zero.
    assert.deepEqual(balanceSplit([{ kind: "checking", balance: "100" }, { kind: "credit", balance: "20" }]), { have: 120, owed: 0, net: 120, hasOwed: true });
  });

  test("loose in/out pairs between your accounts become transfers, and nothing else does", async () => {
    const id = `${me}_pairs`;
    await getProfile(id);
    const a = await createAccount(id, { name: "A", kind: "checking", openingBalance: "0" });
    const b = await createAccount(id, { name: "B", kind: "checking", openingBalance: "0" });
    const fix = (await getCategories(id))[0];
    const row = { categoryId: fix.id, note: null, occurredOn: "2026-10-07", description: "Moving money" };
    await createTransaction(id, { ...row, accountId: a.id, direction: "out", amount: "20000.00" });
    await createTransaction(id, { ...row, accountId: b.id, direction: "in", amount: "20000.00" });
    // Not pairs: another description, the same account, or a different day.
    await createTransaction(id, { ...row, accountId: b.id, direction: "in", amount: "50.00", description: "Refund" });
    await createTransaction(id, { ...row, accountId: a.id, direction: "out", amount: "50.00", description: "Shop" });
    await createTransaction(id, { ...row, accountId: a.id, direction: "out", amount: "10.00" });
    await createTransaction(id, { ...row, accountId: a.id, direction: "in", amount: "10.00" });
    await createTransaction(id, { ...row, accountId: b.id, direction: "in", amount: "10.00", occurredOn: "2026-10-08" });

    const before = await getTotals(id, { from: oct.start, to: oct.end });
    assert.equal(await linkTransfers(id), 1);
    assert.equal(await linkTransfers(id), 0);

    const after = await getTotals(id, { from: oct.start, to: oct.end });
    assert.equal(after.count, before.count);
    assert.deepEqual([after.moneyIn, after.moneyOut], [(Number(before.moneyIn) - 20000).toFixed(2), (Number(before.moneyOut) - 20000).toFixed(2)]);
    const linked = await getTransactions(id, { direction: "transfer" }, { limit: 10, offset: 0 });
    assert.deepEqual(linked.map((r) => r.amount).sort(), ["-20000.00", "20000.00"]);
    assert.ok(linked.every((r) => r.excludeFromBudgets));
    assert.equal((await getTransactions(id, { direction: "in" }, { limit: 10, offset: 0 })).length, 3);
    await deleteAllData(id);
  });

  test("changing a limit counts from this month on; past months keep theirs", async () => {
    const id = `${me}_limits`;
    await getProfile(id);
    const acct = await createAccount(id, { name: "Card", kind: "checking", openingBalance: "0" });
    const now = currentMonth();
    const last = shiftMonth(now.key, -1);
    const budget = await saveBudget(id, { kind: "picked", name: "Monthly", amount: "100" });
    const spend = (month: string, amount: string) =>
      createTransaction(id, { accountId: acct.id, categoryId: null, direction: "out", amount, occurredOn: `${month}-10`, description: "x", note: null, budgetId: budget.id });
    await spend(last.key, "120.00");
    await spend(now.key, "120.00");

    await updateBudget(id, budget.id, { amount: "150" });
    await updateBudget(id, budget.id, { amount: "200" });
    const history = (await getBudgetHistory(id, now, 3))(budget.id);
    assert.deepEqual(
      history.map((h) => [h.spent, h.limit]),
      [
        [0, 100],
        [120, 100],
        [120, 200],
      ],
    );
    // Progress for a month uses that month's limit.
    assert.equal((await getBudgetProgress(id, last))[0].amount, "100.00");
    assert.equal((await getBudgetProgress(id, now))[0].amount, "200.00");
    // Saving the same amount again records nothing new.
    await updateBudget(id, budget.id, { amount: "200.00" });
    assert.equal((await getBudgetProgress(id, last))[0].amount, "100.00");
    await deleteAllData(id);
  });

  test("budgets refuse income categories", async () => {
    const salary = (await getCategories(me)).find((c) => c.name === "Salary")!;
    await assert.rejects(saveBudget(me, { kind: "category", categoryId: salary.id, amount: "10" }), (e: AppError) => e.code === "not_expense_category");
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
