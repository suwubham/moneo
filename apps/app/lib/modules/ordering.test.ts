import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { AppError } from "@/lib/core/errors";
import { createAccount, getAccounts, reorderAccounts, updateAccount } from "./accounts/service";
import { createCategory, getCategories, reorderCategories } from "./categories/service";
import { deleteAllData, getProfile } from "./profiles/service";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);
const me = `test_order_${Date.now()}`;
const other = `${me}_other`;

describe("account and category order against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  before(async () => {
    await getProfile(me);
    await getProfile(other);
  });
  after(async () => {
    await deleteAllData(me);
    await deleteAllData(other);
  });

  test("accounts keep the order they were added, then the order saved", async () => {
    const names = ["Bank", "Cash", "Card"];
    for (const name of names) await createAccount(me, { name, kind: "checking", openingBalance: "0" });
    assert.deepEqual((await getAccounts(me)).map((a) => a.name), names);

    const [bank, cash, card] = await getAccounts(me);
    await reorderAccounts(me, [card.id, bank.id, cash.id]);
    assert.deepEqual((await getAccounts(me)).map((a) => a.name), ["Card", "Bank", "Cash"]);

    // A new one goes to the end; editing does not move anything.
    await createAccount(me, { name: "Savings", kind: "savings", openingBalance: "0" });
    await updateAccount(me, bank.id, { name: "Bank", kind: "checking", openingBalance: "0", icon: "safe", color: "green" });
    const after = await getAccounts(me);
    assert.deepEqual(after.map((a) => a.name), ["Card", "Bank", "Cash", "Savings"]);
    assert.deepEqual([after[1].icon, after[1].color], ["safe", "green"]);
  });

  test("an order must be exactly your own accounts", async () => {
    const mine = (await getAccounts(me)).map((a) => a.id);
    const theirs = (await createAccount(other, { name: "Theirs", kind: "cash", openingBalance: "0" })).id;
    await assert.rejects(reorderAccounts(me, [...mine.slice(1), theirs]), (e: AppError) => e.code === "bad_order");
    await assert.rejects(reorderAccounts(me, mine.slice(1)), (e: AppError) => e.code === "bad_order");
    await assert.rejects(reorderAccounts(other, [theirs, mine[0]]), (e: AppError) => e.code === "bad_order");
  });

  test("categories start in the default order and keep a saved one", async () => {
    const spending = (await getCategories(me)).filter((c) => c.kind === "expense");
    assert.equal(spending[0].name, "Groceries");
    const all = await getCategories(me);
    const reversed = [...all].reverse().map((c) => c.id);
    await reorderCategories(me, reversed);
    const now = (await getCategories(me)).filter((c) => c.kind === "expense").map((c) => c.name);
    assert.deepEqual(now, [...spending].reverse().map((c) => c.name));

    // A new category lands after the others in its group.
    await createCategory(me, { name: "Pets", kind: "expense" });
    assert.equal((await getCategories(me)).filter((c) => c.kind === "expense").at(-1)!.name, "Pets");
  });
});
