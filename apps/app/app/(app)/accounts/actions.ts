"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, parseForm, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { accountInput, createAccount, deleteAccount, setArchived, updateAccount } from "@/lib/modules/accounts/service";

export async function saveAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("save_account", async () => {
    const { id: userId } = await requireUser();
    const input = parseForm(accountInput, form);
    const id = form.get("id");
    if (typeof id === "string" && id) await updateAccount(userId, parseInput(z.uuid(), id), input);
    else await createAccount(userId, input);
    refresh();
  });
}

export async function archiveAccountAction(id: string, archived: boolean): Promise<ActionState> {
  return runAction("archive_account", async () => {
    const { id: userId } = await requireUser();
    await setArchived(userId, parseInput(z.uuid(), id), archived);
    refresh();
  });
}

export async function deleteAccountAction(id: string): Promise<ActionState> {
  return runAction("delete_account", async () => {
    const { id: userId } = await requireUser();
    await deleteAccount(userId, parseInput(z.uuid(), id));
    refresh();
  });
}
