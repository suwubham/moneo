"use server";

import { type ActionState, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { currentMonth, todayIso } from "@/lib/core/dates";
import { monthRead } from "@/lib/modules/ai/insights";

export async function monthReadAction(): Promise<ActionState<string>> {
  return runAction("month_read", async () => {
    const profile = await requireUser();
    return monthRead(profile.id, profile.currency, currentMonth(), todayIso());
  });
}
