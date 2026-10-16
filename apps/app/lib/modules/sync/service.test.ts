import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { createAccount } from "@/lib/modules/accounts/service";
import { deleteAllData, getProfile } from "@/lib/modules/profiles/service";
import { getTransactions } from "@/lib/modules/transactions/service";
import { applyOps, getSnapshot } from "./service";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);
const me = `test_sync_${Date.now()}`;
const other = `${me}_other`;

const input = (accountId: string, description: string) => ({
  accountId,
  categoryId: "",
  direction: "out",
  amount: "12.50",
  occurredOn: "2026-10-02",
  description,
  note: "",
  budgetId: "",
  excludeFromBudgets: "",
});

describe("offline sync against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  let account = "";
  before(async () => {
    await getProfile(me);
    await getProfile(other);
    account = (await createAccount(me, { name: "Wallet", kind: "cash", openingBalance: "0" })).id;
  });
  after(async () => {
    await deleteAllData(me);
    await deleteAllData(other);
  });

  test("a replayed create saves once, then edits and deletes apply in order", async () => {
    const id = randomUUID();
    const create = { opId: randomUUID(), kind: "create" as const, id, input: input(account, "Tea") };
    assert.equal((await applyOps(me, [create])).results[0].ok, true);
    // The device never heard back and sends the same create again.
    assert.equal((await applyOps(me, [create])).results[0].ok, true);
    assert.equal((await getTransactions(me, {}, { limit: 10, offset: 0 })).filter((r) => r.id === id).length, 1);

    const res = await applyOps(me, [
      { opId: randomUUID(), kind: "update", id, input: { ...input(account, "Green tea"), amount: "15" } },
      { opId: randomUUID(), kind: "delete", id },
      // Deleting what is already gone is fine.
      { opId: randomUUID(), kind: "delete", id },
    ]);
    assert.deepEqual(
      res.results.map((r) => r.ok),
      [true, true, true],
    );
    assert.equal((await getTransactions(me, {}, { limit: 10, offset: 0 })).some((r) => r.id === id), false);
  });

  test("a bad change is reported and the rest still apply", async () => {
    const good = randomUUID();
    const res = await applyOps(me, [
      { opId: randomUUID(), kind: "create", id: randomUUID(), input: { ...input(account, "x"), amount: "-3" } },
      { opId: randomUUID(), kind: "create", id: good, input: input(account, "Bus") },
    ]);
    assert.equal(res.results[0].ok, false);
    assert.equal(res.results[1].ok, true);
    assert.equal(res.done, true);
  });

  test("nobody can sync into someone else's account or take their ids", async () => {
    const res = await applyOps(other, [{ opId: randomUUID(), kind: "create", id: randomUUID(), input: input(account, "sneaky") }]);
    assert.equal(res.results[0].ok, false);

    const mine = randomUUID();
    await applyOps(me, [{ opId: randomUUID(), kind: "create", id: mine, input: input(account, "Mine") }]);
    const theirs = (await createAccount(other, { name: "Theirs", kind: "cash", openingBalance: "0" })).id;
    const steal = await applyOps(other, [{ opId: randomUUID(), kind: "create", id: mine, input: input(theirs, "copy") }]);
    assert.equal(steal.results[0].ok, false);
  });

  test("the snapshot carries only the signed-in person's data", async () => {
    const snap = await getSnapshot(me, "NPR");
    assert.equal(snap.userId, me);
    assert.ok(snap.accounts.every((a) => a.name !== "Theirs"));
    assert.ok(snap.transactions.length > 0);
  });
});
