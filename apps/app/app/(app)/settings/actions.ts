"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, parseForm, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { log } from "@/lib/core/log";
import { currencies } from "@/lib/core/money";
import { categoryCreate, createCategory, deleteCategory } from "@/lib/modules/categories/service";
import { deleteAllData, setCurrency } from "@/lib/modules/profiles/service";

export async function currencyAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction(
    "set_currency",
    async () => {
      const { id: userId } = await requireUser();
      const { currency } = parseForm(z.object({ currency: z.enum(currencies) }), form);
      await setCurrency(userId, currency);
      refresh();
    },
    "Saved.",
  );
}

export async function addCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("add_category", async () => {
    const { id: userId } = await requireUser();
    await createCategory(userId, parseForm(categoryCreate, form));
    refresh();
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  return runAction("delete_category", async () => {
    const { id: userId } = await requireUser();
    await deleteCategory(userId, parseInput(z.uuid(), id));
    refresh();
  });
}

export async function deleteEverythingAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("delete_everything", async () => {
    const { id: userId } = await requireUser();
    parseForm(z.object({ confirm: z.literal("delete", "Type delete to confirm.") }), form);
    await deleteAllData(userId);
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userId);
    } catch (err) {
      // The data is already gone; a leftover sign-in can still be removed from the profile menu.
      log.warn("clerk user delete failed", undefined, err);
    }
  });
}
