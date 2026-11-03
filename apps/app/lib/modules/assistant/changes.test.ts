import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { getDb } from "@/lib/db";
import { createAccount, getAccounts } from "@/lib/modules/accounts/service";
import { getCategories } from "@/lib/modules/categories/service";
import { deleteAllData, getProfile } from "@/lib/modules/profiles/service";
import { getTransactions } from "@/lib/modules/transactions/service";
import { insertConversation, insertMessage, insertChanges, listChanges } from "./repository";
import {
  TurnChanges,
  changeRows,
  plainDecimal,
  saveChange,
  saveChanges,
  skipChange,
  suggestAccount,
  suggestAccountDelete,
  suggestNewTransactions,
  suggestTransactionDeletes,
  suggestTransactionEdits,
} from "./changes";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);

test("amounts compare by value, not by spelling", () => {
  assert.equal(plainDecimal("-1200.00"), "-1200");
  assert.equal(plainDecimal("12.50"), "12.5");
  assert.equal(plainDecimal("0.00"), "0");
  assert.equal(plainDecimal("-0"), "0");
  assert.equal(plainDecimal("007.10"), "7.1");
});

describe("suggested changes against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  const me = `test_changes_${Date.now()}`;
  const other = `test_changes_other_${Date.now()}`;
  let account = "";
  let otherAccount = "";

  // Stores a turn's suggestions the way finishTurn does, and returns their ids.
  async function store(userId: string, turn: TurnChanges) {
    const db = getDb();
    const chat = await insertConversation(db, userId, "test");
    const msg = await insertMessage(db, { conversationId: chat.id, userId, role: "assistant", content: "x" });
    await insertChanges(db, changeRows(userId, msg.id, turn));
    return turn.items.map((i) => i.id);
  }

  before(async () => {
    await getProfile(me);
    await getProfile(other);
    account = (await createAccount(me, { name: "Everyday", kind: "checking", openingBalance: "1000" })).id;
    otherAccount = (await createAccount(other, { name: "Theirs", kind: "checking", openingBalance: "0" })).id;
  });

  after(async () => {
    await deleteAllData(me);
    await deleteAllData(other);
  });

  test("new transactions are checked, and nothing is written until saved", async () => {
    const [food] = (await getCategories(me)).filter((c) => c.kind === "expense");
    const turn = new TurnChanges();
    const res = await suggestNewTransactions(me, turn, [
      { account_id: account, direction: "out", amount: "1,250.50", date: "2026-10-02", description: "Grocer", category_id: food.id },
      { account_id: otherAccount, direction: "out", amount: "10", date: "2026-10-02", description: "Not mine" },
      { account_id: account, direction: "out", amount: "abc", date: "2026-10-02", description: "Bad amount" },
      { account_id: account, direction: "in", amount: "500", date: "2026-10-03", description: "Refund", category_id: "made-up" },
    ]);
    assert.equal(res.suggested, 1);
    assert.deepEqual(res.problems.map((p) => p.item), [1, 2, 3]);
    assert.equal(turn.items[0].view.after && "amount" in turn.items[0].view.after && turn.items[0].view.after.amount, "-1250.5");
    assert.equal((await getTransactions(me, {})).length, 0);

    const [id] = await store(me, turn);
    await saveChange(me, id);
    const rows = await getTransactions(me, {});
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, "-1250.50");
    await assert.rejects(saveChange(me, id), { code: "change_done" });
  });

  test("a row already saved nearby is flagged as a maybe-duplicate", async () => {
    const turn = new TurnChanges();
    const res = await suggestNewTransactions(me, turn, [
      { account_id: account, direction: "out", amount: "1250.5", date: "2026-10-04", description: "Grocery store" },
    ]);
    assert.equal(res.maybe_already_saved.length, 1);
    assert.match(turn.items[0].view.warning ?? "", /already/);
  });

  test("someone else cannot save or skip my suggestion", async () => {
    const turn = new TurnChanges();
    await suggestNewTransactions(me, turn, [{ account_id: account, direction: "in", amount: "5", date: "2026-10-05", description: "Tip" }]);
    const [id] = await store(me, turn);
    await assert.rejects(saveChange(other, id), { code: "not_found" });
    await assert.rejects(skipChange(other, id), { code: "not_found" });
    await skipChange(me, id);
    await assert.rejects(saveChange(me, id), { code: "change_done" });
  });

  test("edits and deletes need my own transaction, and an edit stops if it changed since", async () => {
    const [row] = await getTransactions(me, {});
    const turn = new TurnChanges();
    const bad = await suggestTransactionEdits(other, new TurnChanges(), [{ id: row.id, amount: "1" }]);
    assert.equal(bad.suggested, 0);

    const same = await suggestTransactionEdits(me, turn, [{ id: row.id, amount: "1250.50" }]);
    assert.equal(same.suggested, 0);
    await suggestTransactionEdits(me, turn, [{ id: row.id, amount: "1300", description: "Big grocer" }]);
    const [first] = await store(me, turn);

    // A second edit saved first makes the first one stale.
    const turn2 = new TurnChanges();
    await suggestTransactionEdits(me, turn2, [{ id: row.id, note: "checked" }]);
    const [second] = await store(me, turn2);
    await saveChange(me, second);
    await assert.rejects(saveChange(me, first), { code: "changed_since" });

    const del = new TurnChanges();
    await suggestTransactionDeletes(me, del, [row.id, "00000000-0000-4000-8000-000000000000"]);
    assert.equal(del.items.length, 1);
    const [delId] = await store(me, del);
    const results = await saveChanges(me, [delId]);
    assert.deepEqual(results, [{ id: delId, ok: true }]);
    assert.equal((await getTransactions(me, {})).length, 0);
  });

  test("accounts can be added, changed and deleted, and the list is checked", async () => {
    const turn = new TurnChanges();
    await suggestAccount(me, turn, { name: "Visa", kind: "credit", opening_balance: "300" });
    assert.equal(turn.items[0].view.after && "openingBalance" in turn.items[0].view.after && turn.items[0].view.after.openingBalance, "-300");
    const missing = await suggestAccount(me, turn, { id: otherAccount, name: "Mine now" });
    assert.equal(missing.suggested, 0);
    const [addId] = await store(me, turn);
    await saveChange(me, addId);
    const visa = (await getAccounts(me)).find((a) => a.name === "Visa")!;
    assert.equal(visa.openingBalance, "-300.00");

    const edit = new TurnChanges();
    await suggestAccount(me, edit, { id: visa.id, name: "Visa Gold" });
    const del = new TurnChanges();
    await suggestAccountDelete(me, del, visa.id);
    const [editId] = await store(me, edit);
    const [delId] = await store(me, del);
    await saveChange(me, editId);
    assert.ok((await getAccounts(me)).some((a) => a.name === "Visa Gold"));
    await saveChange(me, delId);
    assert.ok(!(await getAccounts(me)).some((a) => a.id === visa.id));
    assert.equal((await listChanges(getDb(), me, [])).length, 0);
  });
});
