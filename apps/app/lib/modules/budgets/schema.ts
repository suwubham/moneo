import { sql } from "drizzle-orm";
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, money, timestamps } from "../../db/columns";
import { categories } from "../categories/schema";
import { profiles } from "../profiles/schema";

// Monthly limits of three kinds:
// - category: spending in one expense category (one budget per category keeps progress maths simple)
// - total: all spending (one per person)
// - picked: only the transactions the person adds to it, by name
export const budgetKinds = ["category", "total", "picked"] as const;
export type BudgetKind = (typeof budgetKinds)[number];

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: budgetKinds }).notNull().default("category"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    name: text("name"),
    amount: money("amount").notNull(),
    ...timestamps(),
  },
  (t) => [
    index("ix_budgets_user").on(t.userId),
    uniqueIndex("uq_budgets_user_category").on(t.userId, t.categoryId),
    uniqueIndex("uq_budgets_user_total").on(t.userId).where(sql`${t.kind} = 'total'`),
    uniqueIndex("uq_budgets_user_picked_name").on(t.userId, sql`lower(${t.name})`).where(sql`${t.kind} = 'picked'`),
    check("ck_budgets_shape", sql`(${t.kind} = 'category') = (${t.categoryId} is not null) and (${t.kind} = 'picked') = (${t.name} is not null)`),
  ],
);

export type Budget = typeof budgets.$inferSelect;
