import "server-only";
import { z } from "zod";
import { AppError, notFound } from "@/lib/core/errors";
import { signedAmountInput } from "@/lib/core/money";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { categoryColors } from "@/lib/modules/categories/look";
import { findAccount, insertAccount, listAccounts, patchAccount, removeAccount, setPositions } from "./repository";
import { accountIcons, accountKinds } from "./constants";

export const accountInput = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60),
  kind: z.enum(accountKinds),
  openingBalance: z.preprocess((v) => (v === "" || v == null ? "0" : v), signedAmountInput),
  // Empty means "the default for the kind".
  icon: z.preprocess((v) => (v === "" ? null : v), z.enum(accountIcons).nullable().optional()),
  color: z.preprocess((v) => (v === "" ? null : v), z.enum(categoryColors).nullable().optional()),
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

// Saves the order the person dragged their accounts into. The list must be exactly their accounts.
export async function reorderAccounts(userId: string, ids: string[]) {
  await unitOfWork(async (tx) => {
    const mine = new Set((await listAccounts(tx, userId)).map((a) => a.id));
    if (ids.length !== mine.size || new Set(ids).size !== ids.length || !ids.every((id) => mine.has(id))) {
      throw new AppError(422, "bad_order", "That order does not match your accounts. Reload and try again.");
    }
    await setPositions(tx, userId, ids);
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
