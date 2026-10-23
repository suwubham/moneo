import "server-only";
import { randomUUID } from "node:crypto";
import { sandboxEnabled, settings } from "@/lib/core/config";
import { log } from "@/lib/core/log";
import { getDb, unitOfWork } from "@/lib/db";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getCategories } from "@/lib/modules/categories/service";
import type { TxRow } from "@/lib/modules/transactions/repository";
import { wrapHtml } from "./html";
import { countFilesSince, findFile, insertFile, listFilesForMessages } from "./repository";
import { type Box, type BoxProvider, vercelBoxes } from "./sandbox";
import type { FileKind } from "./schema";
import { type FileStore, conversationPrefix, fileKey, r2Store, userPrefix } from "./storage";

export const SANDBOX_ROWS = 5000;
const RUNS_PER_TURN = 3;
const FILES_PER_RUN = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const OUTPUT_CHARS = 2000;
const RUN_SECONDS = 30;

const kinds: Record<string, { kind: FileKind; type: string }> = {
  html: { kind: "html", type: "text/html; charset=utf-8" },
  csv: { kind: "csv", type: "text/csv; charset=utf-8" },
  json: { kind: "json", type: "application/json; charset=utf-8" },
};
export const contentTypes: Record<FileKind, string> = { html: kinds.html.type, csv: kinds.csv.type, json: kinds.json.type };

export type FileMeta = { id: string; name: string; kind: FileKind; bytes: number };
type Deps = { boxes: BoxProvider; store: FileStore };
const live: Deps = { boxes: vercelBoxes, store: r2Store };

// What a sandbox gets from a transaction: enough to chart it, nothing typed by the person.
// No description or note, no ids of the row or the user, no timestamps.
export function sandboxTransactions(rows: TxRow[]) {
  return rows.map((t) => ({
    date: t.occurredOn,
    amount: t.amount,
    accountId: t.accountId,
    categoryId: t.categoryId,
    budgetId: t.budgetId,
    excludeFromBudgets: t.excludeFromBudgets,
    transferId: t.transferId,
  }));
}

// One per chat turn, made inside the request and handed to the tools, never kept at module level:
// it holds this person's sandbox and the files this turn made.
export function turnSandbox(userId: string, conversationId: string, deps: Deps = live) {
  let opening: Promise<Box> | null = null;
  let names: Set<string> | null = null;
  let runs = 0;
  const files: FileMeta[] = [];
  const data: string[] = [];

  async function open(signal?: AbortSignal) {
    opening ??= deps.boxes.open(conversationId, signal);
    try {
      return await opening;
    } catch (err) {
      opening = null;
      throw err;
    }
  }

  // The first save of a turn also refreshes the lookups, so a script can show names, not ids.
  async function existing(box: Box, signal?: AbortSignal) {
    if (names) return names;
    const [listed, accounts, categories] = await Promise.all([
      box.exec("mkdir -p data && ls -1 data", signal),
      getAccounts(userId),
      getCategories(userId),
    ]);
    await box.write(
      [
        { path: "data/accounts.json", content: JSON.stringify(accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))) },
        { path: "data/categories.json", content: JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))) },
      ],
      signal,
    );
    names = new Set(listed.stdout.split("\n").filter(Boolean));
    return names;
  }

  return {
    files,
    data,
    get used() {
      return opening !== null;
    },

    // Writes one tool's result into data/ and returns the path. The server picks the name.
    async save(tool: string, args: Record<string, unknown>, rows: unknown, count: number, signal?: AbortSignal) {
      const started = Date.now();
      const box = await open(signal);
      const taken = await existing(box, signal);
      let n = 1;
      while (taken.has(`${tool}_${n}.json`)) n++;
      const name = `${tool}_${n}.json`;
      await box.write([{ path: `data/${name}`, content: JSON.stringify(rows) }], signal);
      taken.add(name);
      data.push(`data/${name}: ${tool} ${JSON.stringify(args)}, ${count} rows`);
      log.info("sandbox data saved", { tool, rows: count, ms: Date.now() - started });
      return `data/${name}`;
    },

    // Runs the model's script against data/ and keeps what it wrote to out/.
    async run(code: string, signal?: AbortSignal): Promise<{ text: string; made: FileMeta[] }> {
      if (runs >= RUNS_PER_TURN) return { text: "Run limit for this message reached. Answer with what you have.", made: [] };
      if (settings.environment === "production") {
        const recent = await countFilesSince(getDb(), userId, new Date(Date.now() - 3_600_000));
        if (recent >= settings.sandboxHourlyLimit) return { text: "The hourly limit for charts and files is reached. Tell the person to try again later.", made: [] };
      }
      runs++;
      const started = Date.now();
      const box = await open(signal);
      await box.write([{ path: "main.py", content: code }], signal);
      const result = await box.exec(`rm -rf out && mkdir -p out && timeout ${RUN_SECONDS} python3 main.py`, signal);
      const listed = await box.exec(
        `python3 -c "import os,json;print(json.dumps([[f,os.path.getsize('out/'+f)] for f in sorted(os.listdir('out')) if os.path.isfile('out/'+f)]))"`,
        signal,
      );
      const found = parseListing(listed.stdout);
      const { keep, skipped } = pickFiles(found);

      const made: FileMeta[] = [];
      for (const f of keep) {
        const raw = await box.read(`out/${f.name}`, signal);
        if (!raw) continue;
        const kind = kinds[ext(f.name)];
        const body = kind.kind === "html" ? Buffer.from(wrapHtml(raw.toString("utf8"))) : raw;
        const id = randomUUID();
        const key = fileKey(userId, conversationId, id);
        await deps.store.put(key, body, kind.type);
        await unitOfWork((tx) => insertFile(tx, { id, userId, conversationId, name: f.name, kind: kind.kind, bytes: body.length, key }));
        made.push({ id, name: f.name, kind: kind.kind, bytes: body.length });
      }
      files.push(...made);
      log.info("sandbox run", { exit: result.exitCode, files: made.length, skipped: skipped.length, ms: Date.now() - started });

      const output = clip(`${result.stdout}${result.stderr ? `\n${result.stderr}` : ""}`.trim());
      const lines = [
        result.exitCode === 124 ? `The script was stopped after ${RUN_SECONDS} seconds.` : `Exit code ${result.exitCode}.`,
        made.length ? `Files shown to the person: ${made.map((f) => f.name).join(", ")}.` : "No files were made.",
        ...skipped.map((s) => `Skipped ${s.name}: ${s.why}.`),
        output ? `Output:\n${output}` : "",
      ];
      return { text: lines.filter(Boolean).join("\n"), made };
    },

    async stop() {
      if (!opening) return;
      const started = Date.now();
      try {
        await (await opening).stop();
        log.info("sandbox stopped", { ms: Date.now() - started });
      } catch (err) {
        log.warn("sandbox stop failed", { ms: Date.now() - started }, err);
      }
    },
  };
}

export type TurnSandbox = ReturnType<typeof turnSandbox>;

const ext = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();
const clip = (s: string) => (s.length > OUTPUT_CHARS ? `${s.slice(0, OUTPUT_CHARS)}\n…(cut)` : s);

function parseListing(stdout: string): { name: string; size: number }[] {
  try {
    const rows = JSON.parse(stdout.trim() || "[]") as [string, number][];
    return rows.map(([name, size]) => ({ name, size }));
  } catch {
    return [];
  }
}

export function pickFiles(found: { name: string; size: number }[]) {
  const keep: { name: string; size: number }[] = [];
  const skipped: { name: string; why: string }[] = [];
  for (const f of found) {
    if (!/^[\w.-]{1,80}$/.test(f.name) || !kinds[ext(f.name)]) skipped.push({ name: f.name, why: "only .html, .csv and .json files with plain names are kept" });
    else if (f.size > MAX_BYTES) skipped.push({ name: f.name, why: "over 2 MB" });
    else if (keep.length >= FILES_PER_RUN) skipped.push({ name: f.name, why: `only ${FILES_PER_RUN} files per run` });
    else keep.push(f);
  }
  return { keep, skipped };
}

export function getFilesFor(userId: string, messageIds: string[]) {
  return listFilesForMessages(getDb(), userId, messageIds);
}

export async function getFile(userId: string, id: string, deps: Deps = live) {
  const row = await findFile(getDb(), userId, id);
  if (!row) return null;
  const object = await deps.store.get(row.key);
  return object ? { ...row, ...object } : null;
}

// Called after the database rows are gone. A failure here leaves bytes no one can reach, so it is logged, not thrown.
export async function removeChatFiles(userId: string, conversationId: string, deps: Deps = live) {
  if (!sandboxEnabled && deps === live) return;
  const results = await Promise.allSettled([deps.store.deletePrefix(conversationPrefix(userId, conversationId)), deps.boxes.remove(conversationId)]);
  for (const r of results) if (r.status === "rejected") log.warn("chat files cleanup failed", undefined, r.reason);
}

export async function removeUserFiles(userId: string, conversationIds: string[], deps: Deps = live) {
  if (!sandboxEnabled && deps === live) return;
  const results = await Promise.allSettled([deps.store.deletePrefix(userPrefix(userId)), ...conversationIds.map((id) => deps.boxes.remove(id))]);
  for (const r of results) if (r.status === "rejected") log.warn("user files cleanup failed", undefined, r.reason);
}
