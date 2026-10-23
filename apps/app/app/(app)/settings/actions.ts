"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionState, parseForm, parseInput, runAction } from "@/lib/core/action";
import { requireUser } from "@/lib/core/auth";
import { log } from "@/lib/core/log";
import { currencies } from "@/lib/core/money";
import { categoryCreate, categoryUpdate, createCategory, deleteCategory, reorderCategories, updateCategory } from "@/lib/modules/categories/service";
import { type ImportResult, importCashew } from "@/lib/modules/imports/service";
import { addFromEmail, addFromEmailInput, createHint, deleteHint, dismissEmail, hintInput, newAddress, updateHint } from "@/lib/modules/inbound/service";
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

export async function updateCategoryAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("update_category", async () => {
    const { id: userId } = await requireUser();
    const id = parseInput(z.uuid(), form.get("id"));
    await updateCategory(userId, id, parseForm(categoryUpdate, form));
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

const importForm = z.object({
  file: z.instanceof(File, { message: "Pick a Cashew backup file." }).refine((f) => f.size > 0, "Pick a Cashew backup file."),
  tz: z.coerce.number().int().min(-840).max(840).catch(0),
});

export async function importCashewAction(_: ActionState<ImportResult>, form: FormData): Promise<ActionState<ImportResult>> {
  return runAction("import_cashew", async () => {
    const { id: userId } = await requireUser();
    const { file, tz } = parseInput(importForm, { file: form.get("file"), tz: form.get("tz") });
    const result = await importCashew(userId, new Uint8Array(await file.arrayBuffer()), tz);
    refresh();
    return result;
  });
}

export async function reorderCategoriesAction(ids: string[]): Promise<ActionState> {
  return runAction("reorder_categories", async () => {
    const { id: userId } = await requireUser();
    await reorderCategories(userId, parseInput(z.array(z.uuid()).max(500), ids));
    refresh();
  });
}

export async function newAddressAction(): Promise<ActionState<string>> {
  return runAction("new_inbox_address", async () => {
    const { id: userId } = await requireUser();
    const address = await newAddress(userId);
    refresh();
    return address;
  });
}

// Adds a hint, or changes one when the form carries its id.
export async function saveHintAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("save_hint", async () => {
    const { id: userId } = await requireUser();
    const input = parseForm(hintInput, form);
    const id = form.get("id");
    if (id) await updateHint(userId, parseInput(z.uuid(), id), input);
    else await createHint(userId, input);
    refresh();
  });
}

export async function deleteHintAction(id: string): Promise<ActionState> {
  return runAction("delete_hint", async () => {
    const { id: userId } = await requireUser();
    await deleteHint(userId, parseInput(z.uuid(), id));
    refresh();
  });
}

export async function addFromEmailAction(_: ActionState, form: FormData): Promise<ActionState> {
  return runAction("add_from_email", async () => {
    const { id: userId } = await requireUser();
    const id = parseInput(z.uuid(), form.get("id"));
    await addFromEmail(userId, id, parseForm(addFromEmailInput, form));
    refresh();
  });
}

export async function dismissEmailAction(id: string): Promise<ActionState> {
  return runAction("dismiss_email", async () => {
    const { id: userId } = await requireUser();
    await dismissEmail(userId, parseInput(z.uuid(), id));
    refresh();
  });
}
