import "server-only";
import { z } from "zod";
import { AppError, notFound } from "@/lib/core/errors";
import { amountInput, withSign } from "@/lib/core/money";
import { getDb, unitOfWork } from "@/lib/db";
import { assertAccount } from "@/lib/modules/accounts/service";
import { assertPickedBudget } from "@/lib/modules/budgets/service";
import { assertCategory } from "@/lib/modules/categories/service";
import {
  type TxFilter,
  findTransaction,
  insertTransaction,
  insertTransactionOnce,
  listTransactions,
  patchTransaction,
  removeTransaction,
  totals,
} from "./repository";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

export const transactionInput = z.object({
  accountId: z.uuid("Pick an account."),
  categoryId: optionalId,
  direction: z.enum(["out", "in"]),
  amount: amountInput,
  occurredOn: z.iso.date("Pick a date."),
  description: z.string().trim().min(1, "Say what it was.").max(140),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(500).nullable()),
  budgetId: optionalId,
  // A checkbox: "on" when ticked, missing when not.
  excludeFromBudgets: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
});

type Parsed = z.infer<typeof transactionInput>;
export type TransactionInput = Omit<Parsed, "budgetId" | "excludeFromBudgets"> & Partial<Pick<Parsed, "budgetId" | "excludeFromBudgets">>;

export const PAGE_SIZE = 50;

export function getTransactions(userId: string, filter: TxFilter, page = { limit: PAGE_SIZE, offset: 0 }) {
  return listTransactions(getDb(), userId, filter, page);
}

export function getTotals(userId: string, filter: TxFilter) {
  return totals(getDb(), userId, filter);
}

function toRow(input: TransactionInput) {
  const { direction, amount, budgetId = null, excludeFromBudgets = false, ...rest } = input;
  return { ...rest, budgetId, excludeFromBudgets, amount: withSign(amount, direction) };
}

export async function createTransaction(userId: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    await assertPickedBudget(userId, input.budgetId, tx);
    return insertTransaction(tx, { userId, ...toRow(input) });
  });
}

// A create sent from the offline outbox. Replaying it is harmless: the id is the device's, so the second try finds the first.
export async function createTransactionOnce(userId: string, id: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    await assertPickedBudget(userId, input.budgetId, tx);
    const created = await insertTransactionOnce(tx, { id, userId, ...toRow(input) });
    if (created) return created;
    const existing = await findTransaction(tx, userId, id);
    if (!existing) throw new AppError(409, "id_taken", "That transaction id is already used.");
    return existing;
  });
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    await assertPickedBudget(userId, input.budgetId, tx);
    const row = await patchTransaction(tx, userId, id, toRow(input));
    if (!row) throw notFound("transaction");
    return row;
  });
}

export async function deleteTransaction(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeTransaction(tx, userId, id))) throw notFound("transaction");
  });
}
