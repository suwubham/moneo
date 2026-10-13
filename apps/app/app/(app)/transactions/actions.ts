"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, parseForm, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { type Draft, draftTransaction } from "@/lib/modules/ai/quick-add";
import { createTransaction, deleteTransaction, transactionInput, updateTransaction } from "@/lib/modules/transactions/service";

export async function saveTransactionAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("save_transaction", async () => {
    const { id: userId } = await requireUser();
    const input = parseForm(transactionInput, form);
    const id = form.get("id");
    if (typeof id === "string" && id) await updateTransaction(userId, parseInput(z.uuid(), id), input);
    else await createTransaction(userId, input);
    refresh();
  });
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
  return runAction("delete_transaction", async () => {
    const { id: userId } = await requireUser();
    await deleteTransaction(userId, parseInput(z.uuid(), id));
    refresh();
  });
}

export async function draftTransactionAction(text: string): Promise<ActionState<Draft>> {
  return runAction("draft_transaction", async () => {
    const { id: userId } = await requireUser();
    const note = parseInput(z.string().trim().min(2, "Type a little more.").max(300), text);
    return draftTransaction(userId, note);
  });
}
