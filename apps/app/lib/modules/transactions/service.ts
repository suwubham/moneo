import "server-only";
import { z } from "zod";
import { notFound } from "@/lib/core/errors";
import { amountInput, withSign } from "@/lib/core/money";
import { getDb, unitOfWork } from "@/lib/db";
import { assertAccount } from "@/lib/modules/accounts/service";
import { assertCategory } from "@/lib/modules/categories/service";
import { type TxFilter, insertTransaction, listTransactions, patchTransaction, removeTransaction, totals } from "./repository";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());

export const transactionInput = z.object({
  accountId: z.uuid("Pick an account."),
  categoryId: optionalId,
  direction: z.enum(["out", "in"]),
  amount: amountInput,
  occurredOn: z.iso.date("Pick a date."),
  description: z.string().trim().min(1, "Say what it was.").max(140),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(500).nullable()),
});

export type TransactionInput = z.infer<typeof transactionInput>;

export const PAGE_SIZE = 50;

export function getTransactions(userId: string, filter: TxFilter, page = { limit: PAGE_SIZE, offset: 0 }) {
  return listTransactions(getDb(), userId, filter, page);
}

export function getTotals(userId: string, filter: TxFilter) {
  return totals(getDb(), userId, filter);
}

function toRow(input: TransactionInput) {
  const { direction, amount, ...rest } = input;
  return { ...rest, amount: withSign(amount, direction) };
}

export async function createTransaction(userId: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    return insertTransaction(tx, { userId, ...toRow(input) });
  });
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
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
