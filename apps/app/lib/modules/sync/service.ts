import "server-only";
import { z } from "zod";
import { currentMonth, shiftDays, todayIso } from "@/lib/core/dates";
import { AppError, toErrorBody, validationError } from "@/lib/core/errors";
import { log } from "@/lib/core/log";
import { getAccounts } from "@/lib/modules/accounts/service";
import { getBudgetProgress, getPickedBudgets } from "@/lib/modules/budgets/service";
import { getCategories } from "@/lib/modules/categories/service";
import { createTransactionOnce, deleteTransaction, getTransactions, transactionInput, updateTransaction } from "@/lib/modules/transactions/service";

// What the device keeps so the app can show something without a connection: balances, budgets and recent rows.
export async function getSnapshot(userId: string, currency: string) {
  const today = todayIso();
  const month = currentMonth();
  const [accounts, categories, budgets, picked, transactions] = await Promise.all([
    getAccounts(userId),
    getCategories(userId),
    getBudgetProgress(userId, month),
    getPickedBudgets(userId),
    getTransactions(userId, { from: shiftDays(today, -90) }, { limit: 300, offset: 0 }),
  ]);
  return {
    version: 1,
    userId,
    currency,
    asOf: new Date().toISOString(),
    today,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind, balance: a.balance, archived: Boolean(a.archivedAt) })),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, icon: c.icon, color: c.color })),
    budgets: budgets.map((b) => ({ id: b.id, name: b.name, kind: b.kind, categoryId: b.categoryId, amount: b.amount, spent: b.spent })),
    picked,
    transactions,
  };
}

export type Snapshot = Awaited<ReturnType<typeof getSnapshot>>;

const opId = z.uuid();
const txId = z.uuid();

export const syncBody = z.object({
  ops: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ opId, kind: z.literal("create"), id: txId, input: z.record(z.string(), z.unknown()) }),
        z.object({ opId, kind: z.literal("update"), id: txId, input: z.record(z.string(), z.unknown()) }),
        z.object({ opId, kind: z.literal("delete"), id: txId }),
      ]),
    )
    .max(200),
});

export type SyncResult = { opId: string; ok: true } | { opId: string; ok: false; error: { code: string; message: string } };

// Applies queued changes in the order they were made. A change the server rejects for good (a deleted account,
// bad input) comes back as failed so the device can show it; a server fault stops the run and the rest wait.
export async function applyOps(userId: string, ops: z.infer<typeof syncBody>["ops"]) {
  const started = Date.now();
  const results: SyncResult[] = [];
  for (const op of ops) {
    try {
      if (op.kind === "delete") {
        await deleteTransaction(userId, op.id).catch((err) => {
          // Already gone is what a delete wants.
          if (!(err instanceof AppError && err.status === 404)) throw err;
        });
      } else {
        const parsed = transactionInput.safeParse(op.input);
        if (!parsed.success) throw validationError(parsed.error.issues);
        const input = parsed.data;
        if (op.kind === "create") await createTransactionOnce(userId, op.id, input);
        else await updateTransaction(userId, op.id, input);
      }
      results.push({ opId: op.opId, ok: true });
    } catch (err) {
      if (err instanceof AppError && err.status < 500) {
        results.push({ opId: op.opId, ok: false, error: { code: err.code, message: err.message } });
        continue;
      }
      log.error("sync op failed", { kind: op.kind }, err);
      break;
    }
  }
  log.info("sync", { ops: ops.length, applied: results.filter((r) => r.ok).length, ms: Date.now() - started });
  return { results, done: results.length === ops.length, error: results.length < ops.length ? toErrorBody(null).body : undefined };
}
