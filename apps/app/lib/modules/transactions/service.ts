import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, notFound, validationError } from "@/lib/core/errors";
import { amountInput, withSign } from "@/lib/core/money";
import { getDb, unitOfWork } from "@/lib/db";
import { assertAccount } from "@/lib/modules/accounts/service";
import { assertPickedBudget } from "@/lib/modules/budgets/service";
import { assertCategory } from "@/lib/modules/categories/service";
import {
  type TxFilter,
  findTransaction,
  findTransferLegs,
  insertTransaction,
  insertTransactionOnce,
  linkTransferPairs,
  listTransactions,
  patchTransaction,
  removeTransaction,
  removeTransfer,
  totals,
} from "./repository";

const optionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid().nullable());
const optionalNote = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(500).nullable());
const description = z.string().trim().min(1, "Say what it was.").max(140);

export const transactionInput = z.object({
  accountId: z.uuid("Pick an account."),
  categoryId: optionalId,
  direction: z.enum(["out", "in"]),
  amount: amountInput,
  occurredOn: z.iso.date("Pick a date."),
  description,
  note: optionalNote,
  budgetId: optionalId,
  // A checkbox: "on" when ticked, missing when not.
  excludeFromBudgets: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
});

type Parsed = z.infer<typeof transactionInput>;
export type TransactionInput = Omit<Parsed, "budgetId" | "excludeFromBudgets"> & Partial<Pick<Parsed, "budgetId" | "excludeFromBudgets">>;

export const transferInput = z
  .object({
    fromAccountId: z.uuid("Pick the account it leaves."),
    toAccountId: z.uuid("Pick the account it goes to."),
    amount: amountInput,
    occurredOn: z.iso.date("Pick a date."),
    description,
    note: optionalNote,
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { message: "Pick two different accounts.", path: ["toAccountId"] });

export type TransferInput = z.infer<typeof transferInput>;

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

// One row of a transfer is changed through its transfer, so the two rows never disagree.
const partOfTransfer = () => new AppError(409, "part_of_transfer", "This is one side of a transfer. Change the transfer instead.");

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  return unitOfWork(async (tx) => {
    if ((await findTransaction(tx, userId, id))?.transferId) throw partOfTransfer();
    await assertAccount(userId, input.accountId, tx);
    await assertCategory(userId, input.categoryId, tx);
    await assertPickedBudget(userId, input.budgetId, tx);
    const row = await patchTransaction(tx, userId, id, toRow(input));
    if (!row) throw notFound("transaction");
    return row;
  });
}

// Deleting either row of a transfer deletes both.
export async function deleteTransaction(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    const row = await findTransaction(tx, userId, id);
    if (!row) throw notFound("transaction");
    if (row.transferId) await removeTransfer(tx, userId, row.transferId);
    else await removeTransaction(tx, userId, id);
  });
}

// A transfer is two rows: money out of one account and the same money into the other. Neither counts as spending
// or income, so both stay out of budgets and reports.
function transferRows(userId: string, transferId: string, input: TransferInput) {
  if (input.fromAccountId === input.toAccountId) throw validationError([{ path: ["toAccountId"], message: "Pick two different accounts." }]);
  const shared = { userId, transferId, occurredOn: input.occurredOn, description: input.description, note: input.note, categoryId: null, budgetId: null, excludeFromBudgets: true };
  return {
    out: { ...shared, accountId: input.fromAccountId, amount: withSign(input.amount, "out") },
    in: { ...shared, accountId: input.toAccountId, amount: withSign(input.amount, "in") },
  };
}

export async function createTransfer(userId: string, input: TransferInput) {
  return unitOfWork(async (tx) => {
    const transferId = randomUUID();
    const rows = transferRows(userId, transferId, input);
    await assertAccount(userId, input.fromAccountId, tx);
    await assertAccount(userId, input.toAccountId, tx);
    await insertTransaction(tx, rows.out);
    await insertTransaction(tx, rows.in);
    return { transferId };
  });
}

export async function updateTransfer(userId: string, transferId: string, input: TransferInput) {
  return unitOfWork(async (tx) => {
    const rows = transferRows(userId, transferId, input);
    await assertAccount(userId, input.fromAccountId, tx);
    await assertAccount(userId, input.toAccountId, tx);
    const legs = await findTransferLegs(tx, userId, transferId);
    const out = legs.find((l) => l.amount.startsWith("-"));
    const into = legs.find((l) => !l.amount.startsWith("-"));
    if (!out || !into) throw notFound("transfer");
    await patchTransaction(tx, userId, out.id, rows.out);
    await patchTransaction(tx, userId, into.id, rows.in);
    return { transferId };
  });
}

// Turns loose in/out pairs between your own accounts into transfers. See linkTransferPairs for what counts as a pair.
export async function linkTransfers(userId: string) {
  return unitOfWork((tx) => linkTransferPairs(tx, userId));
}

export async function deleteTransfer(userId: string, transferId: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeTransfer(tx, userId, transferId))) throw notFound("transfer");
  });
}
