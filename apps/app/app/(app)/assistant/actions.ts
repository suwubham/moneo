"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { deleteConversation } from "@/lib/modules/assistant/service";

export async function deleteConversationAction(id: string): Promise<ActionState> {
  const res = await runAction("delete_conversation", async () => {
    const { id: userId } = await requireUser();
    await deleteConversation(userId, parseInput(z.uuid(), id));
  });
  if (res?.ok) redirect("/assistant");
  return res;
}
