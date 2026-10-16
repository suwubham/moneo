import "server-only";
import { z } from "zod";
import { AppError, notFound } from "@/lib/core/errors";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { categoryColors, categoryIcons, guessLook } from "./look";
import { findCategory, insertCategories, listCategories, patchCategory, removeCategory } from "./repository";
import { categoryKinds } from "./schema";

const defaults = {
  expense: ["Groceries", "Dining", "Transport", "Housing", "Utilities", "Health", "Shopping", "Entertainment", "Subscriptions", "Travel", "Education", "Gifts", "Other"],
  income: ["Salary", "Freelance", "Interest", "Refunds", "Other income"],
};

export async function seedDefaultCategories(tx: Tx, userId: string) {
  await insertCategories(tx, [
    ...defaults.expense.map((name) => ({ userId, name, kind: "expense" as const, ...guessLook(name) })),
    ...defaults.income.map((name) => ({ userId, name, kind: "income" as const, ...guessLook(name) })),
  ]);
}

export const categoryCreate = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  kind: z.enum(categoryKinds),
});

export const categoryUpdate = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  icon: z.enum(categoryIcons),
  color: z.enum(categoryColors),
});

export function getCategories(userId: string) {
  return listCategories(getDb(), userId);
}

export async function createCategory(userId: string, input: z.infer<typeof categoryCreate>) {
  return unitOfWork(async (tx) => {
    const [row] = await insertCategories(tx, [{ userId, ...input, ...guessLook(input.name) }]);
    if (!row) throw new AppError(409, "category_exists", "You already have a category with that name.");
    return row;
  });
}

export async function updateCategory(userId: string, id: string, input: z.infer<typeof categoryUpdate>) {
  return unitOfWork(async (tx) => {
    try {
      const row = await patchCategory(tx, userId, id, input);
      if (!row) throw notFound("category");
      return row;
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === "23505") {
        throw new AppError(409, "category_exists", "You already have a category with that name.");
      }
      throw err;
    }
  });
}

export async function deleteCategory(userId: string, id: string) {
  await unitOfWork(async (tx) => {
    if (!(await removeCategory(tx, userId, id))) throw notFound("category");
  });
}

export async function assertCategory(userId: string, id: string | null | undefined, tx?: Tx) {
  if (!id) return null;
  const row = await findCategory(tx ?? getDb(), userId, id);
  if (!row) throw notFound("category");
  return row;
}
