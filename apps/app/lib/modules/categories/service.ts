import "server-only";
import { z } from "zod";
import { AppError, notFound } from "@/lib/core/errors";
import { getDb, type Tx, unitOfWork } from "@/lib/db";
import { findCategory, insertCategories, listCategories, removeCategory } from "./repository";
import { categoryKinds } from "./schema";

const defaults = {
  expense: ["Groceries", "Dining", "Transport", "Housing", "Utilities", "Health", "Shopping", "Entertainment", "Subscriptions", "Travel", "Education", "Gifts", "Other"],
  income: ["Salary", "Freelance", "Interest", "Refunds", "Other income"],
};

export async function seedDefaultCategories(tx: Tx, userId: string) {
  await insertCategories(tx, [
    ...defaults.expense.map((name) => ({ userId, name, kind: "expense" as const })),
    ...defaults.income.map((name) => ({ userId, name, kind: "income" as const })),
  ]);
}

export const categoryCreate = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  kind: z.enum(categoryKinds),
});

export function getCategories(userId: string) {
  return listCategories(getDb(), userId);
}

export async function createCategory(userId: string, input: z.infer<typeof categoryCreate>) {
  return unitOfWork(async (tx) => {
    const [row] = await insertCategories(tx, [{ userId, ...input }]);
    if (!row) throw new AppError(409, "category_exists", "You already have a category with that name.");
    return row;
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
