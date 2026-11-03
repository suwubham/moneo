"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { saveChanges, skipChange } from "@/lib/modules/assistant/changes";
import { deleteConversation } from "@/lib/modules/assistant/service";

export async function deleteConversationAction(id: string): Promise<ActionState> {
  const res = await runAction("delete_conversation", async () => {
    const { id: userId } = await requireUser();
    await deleteConversation(userId, parseInput(z.uuid(), id));
  });
  if (res?.ok) redirect("/assistant");
  return res;
}

// The person saved one suggested change, or all that are left on a card.
export async function saveChangesAction(ids: string[]): Promise<ActionState<{ id: string; ok: boolean; message?: string }[]>> {
  return runAction("save_changes", async () => {
    const { id: userId } = await requireUser();
    const results = await saveChanges(userId, parseInput(z.array(z.uuid()).min(1).max(40), ids));
    if (results.some((r) => r.ok)) refresh();
    return results;
  });
}

export async function skipChangeAction(id: string): Promise<ActionState> {
  return runAction("skip_change", async () => {
    const { id: userId } = await requireUser();
    await skipChange(userId, parseInput(z.uuid(), id));
  });
}
