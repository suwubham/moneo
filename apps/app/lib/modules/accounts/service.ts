import "server-only";
import { z } from "zod";
import { notFound } from "@/lib/core/errors";
import { signedAmountInput } from "@/lib/core/money";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { findAccount, insertAccount, listAccounts, patchAccount, removeAccount } from "./repository";
import { accountKinds } from "./constants";

export const accountInput = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60),
  kind: z.enum(accountKinds),
  openingBalance: z.preprocess((v) => (v === "" || v == null ? "0" : v), signedAmountInput),
});

export function getAccounts(userId: string) {
  return listAccounts(getDb(), userId);
}

export async function createAccount(userId: string, input: z.infer<typeof accountInput>) {
  return unitOfWork((tx) => insertAccount(tx, { userId, ...input }));
}

export async function updateAccount(userId: string, id: string, input: z.infer<typeof accountInput>) {
  return unitOfWork(async (tx) => {
    const row = await patchAccount(tx, userId, id, input);
    if (!row) throw notFound("account");
    return row;
  });
}

export async function setArchived(userId: string, id: string, archived: boolean) {
  await unitOfWork(async (tx) => {
    const row = await patchAccount(tx, userId, id, { archivedAt: archived ? new Date() : null });
    if (!row) throw notFound("account");
  });
}

export async function deleteAccount(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeAccount(tx, userId, id))) throw notFound("account");
  });
}

export async function assertAccount(userId: string, id: string, tx?: Tx) {
  const row = await findAccount(tx ?? getDb(), userId, id);
  if (!row) throw notFound("account");
  return row;
}
