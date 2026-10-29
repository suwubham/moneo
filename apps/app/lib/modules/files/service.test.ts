import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { getDb } from "@/lib/db";
import { insertConversation } from "@/lib/modules/assistant/repository";
import { deleteAllData, getProfile } from "@/lib/modules/profiles/service";
import type { TxRow } from "@/lib/modules/transactions/repository";
import type { Box, BoxProvider } from "./sandbox";
import { getFile, pickFiles, removeChatFiles, sandboxTransactions, turnSandbox } from "./service";
import type { FileStore } from "./storage";

const hasDb = Boolean(process.env.DATABASE_URL || process.env.APP_DATABASE_URL);

test("a sandbox gets the names a view shows, but no row or user ids", () => {
  const row = {
    id: "t1",
    amount: "-12.50",
    occurredOn: "2026-10-01",
    description: "Dinner with a friend",
    note: "private",
    accountId: "a1",
    accountName: "Everyday",
    categoryId: "c1",
    categoryName: "Dining",
    budgetId: null,
    excludeFromBudgets: false,
    transferId: null,
  } as unknown as TxRow;
  const [out] = sandboxTransactions([row]);
  assert.deepEqual(Object.keys(out).sort(), [
    "account", "accountId", "amount", "budget", "budgetId", "category", "categoryId", "date", "description", "excludeFromBudgets", "note", "transferId",
  ]);
  assert.equal(out.description, "Dinner with a friend");
  assert.ok(!("id" in out) && !("userId" in out));
});

test("only small html, csv and json files with plain names are kept, three at most", () => {
  const { keep, skipped } = pickFiles([
    { name: "a.html", size: 10 },
    { name: "b.csv", size: 10 },
    { name: "run.sh", size: 10 },
    { name: "../x.json", size: 10 },
    { name: "big.json", size: 3 * 1024 * 1024 },
    { name: "c.json", size: 10 },
    { name: "d.csv", size: 10 },
  ]);
  assert.deepEqual(keep.map((f) => f.name), ["a.html", "b.csv", "c.json"]);
  assert.deepEqual(skipped.map((f) => f.name), ["run.sh", "../x.json", "big.json", "d.csv"]);
});

// A sandbox in memory. "Running" a script copies whatever `outputs` says into out/.
function fakeBoxes(outputs: Record<string, string>) {
  const fs = new Map<string, Buffer>();
  const removed: string[] = [];
  let stops = 0;
  const box: Box = {
    async write(files) {
      for (const f of files) fs.set(f.path, Buffer.from(f.content));
    },
    async exec(script) {
      if (script.startsWith("mkdir -p data")) {
        const names = [...fs.keys()].filter((k) => k.startsWith("data/")).map((k) => k.slice(5));
        return { exitCode: 0, stdout: names.join("\n"), stderr: "" };
      }
      if (script.includes("python3 main.py")) {
        for (const k of [...fs.keys()]) if (k.startsWith("out/")) fs.delete(k);
        for (const [name, body] of Object.entries(outputs)) fs.set(`out/${name}`, Buffer.from(body));
        return { exitCode: 0, stdout: "made it", stderr: "" };
      }
      const listed = [...fs.entries()].filter(([k]) => k.startsWith("out/")).map(([k, v]) => [k.slice(4), v.length]);
      return { exitCode: 0, stdout: JSON.stringify(listed), stderr: "" };
    },
    async read(path) {
      return fs.get(path) ?? null;
    },
    async stop() {
      stops++;
    },
  };
  const boxes: BoxProvider = {
    async open() {
      return box;
    },
    async remove(id) {
      removed.push(id);
    },
  };
  return { boxes, fs, removed, stops: () => stops };
}

function fakeStore() {
  const objects = new Map<string, Buffer>();
  const store: FileStore = {
    async put(key, body) {
      objects.set(key, Buffer.from(body));
    },
    async get(key) {
      const b = objects.get(key);
      return b ? { body: new Blob([new Uint8Array(b)]).stream(), bytes: b.length } : null;
    },
    async deletePrefix(prefix) {
      for (const k of [...objects.keys()]) if (k.startsWith(prefix)) objects.delete(k);
    },
  };
  return { store, objects };
}

describe("chat sandbox files against Postgres", { skip: !hasDb && "no DATABASE_URL" }, () => {
  const me = `test_files_${Date.now()}`;
  const other = `${me}_other`;
  let chat = "";

  before(async () => {
    await getProfile(me);
    await getProfile(other);
    chat = (await insertConversation(getDb(), me, "charts")).id;
  });

  after(async () => {
    await deleteAllData(me);
    await deleteAllData(other);
  });

  test("saved data gets a fresh name, a script's files reach R2, and only the owner can read them", async () => {
    const sb = fakeBoxes({ "spend.html": "<p>chart</p>", "spend.csv": "a,b\n1,2\n", "notes.txt": "x" });
    const r2 = fakeStore();
    const deps = { boxes: sb.boxes, store: r2.store };

    const box = turnSandbox(me, chat, deps);
    assert.equal(box.used, false);
    assert.equal(await box.save("search_transactions", { from: "2026-10-01" }, [{ amount: "-1.00" }], 1), "data/search_transactions_1.json");
    assert.equal(await box.save("search_transactions", {}, [], 0), "data/search_transactions_2.json");
    assert.ok(sb.fs.has("data/accounts.json") && sb.fs.has("data/categories.json"));
    assert.equal(box.data.length, 2);

    // A later turn sees what is already there and does not write over it.
    const next = turnSandbox(me, chat, deps);
    assert.equal(await next.save("search_transactions", {}, [], 0), "data/search_transactions_3.json");

    const { text, made } = await box.run("print('hi')");
    assert.deepEqual(made.map((f) => f.name), ["spend.html", "spend.csv"]);
    assert.match(text, /Skipped notes\.txt/);
    assert.match(text, /made it/);
    assert.equal(r2.objects.size, 2);
    const page = [...r2.objects.values()].find((b) => b.toString().includes("chart"))!.toString();
    assert.match(page, /Content-Security-Policy/);

    const html = made.find((f) => f.kind === "html")!;
    assert.ok(await getFile(me, html.id, deps));
    assert.equal(await getFile(other, html.id, deps), null);

    await box.stop();
    assert.equal(sb.stops(), 1);
    await turnSandbox(me, chat, deps).stop();
    assert.equal(sb.stops(), 1, "a turn that never opened the sandbox does not stop it");

    await removeChatFiles(me, chat, deps);
    assert.equal(r2.objects.size, 0);
    assert.deepEqual(sb.removed, [chat]);
  });

  test("three runs per turn, then the model is told to answer with what it has", async () => {
    const sb = fakeBoxes({});
    const box = turnSandbox(me, chat, { boxes: sb.boxes, store: fakeStore().store });
    for (let i = 0; i < 3; i++) await box.run("pass");
    const fourth = await box.run("pass");
    assert.match(fourth.text, /Run limit/);
  });
});
