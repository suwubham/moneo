import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, money, timestamps } from "../../db/columns";
import { categories } from "../categories/schema";
import { profiles } from "../profiles/schema";

// Monthly limit per expense category. One budget per category keeps progress maths simple.
export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_budgets_user_category").on(t.userId, t.categoryId)],
);

export type Budget = typeof budgets.$inferSelect;
