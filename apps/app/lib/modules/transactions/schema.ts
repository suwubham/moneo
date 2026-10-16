import { boolean, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, money, timestamps } from "../../db/columns";
import { accounts } from "../accounts/schema";
import { budgets } from "../budgets/schema";
import { categories } from "../categories/schema";
import { profiles } from "../profiles/schema";

// Amount is signed: negative is money out of the account, positive is money in.
export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    amount: money("amount").notNull(),
    occurredOn: date("occurred_on").notNull(),
    description: text("description").notNull(),
    note: text("note"),
    // The one "picked" budget this counts towards, if any.
    budgetId: uuid("budget_id").references(() => budgets.id, { onDelete: "set null" }),
    // Left out of category and total budgets, e.g. a transfer between your own accounts.
    excludeFromBudgets: boolean("exclude_from_budgets").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    index("ix_transactions_user_date").on(t.userId, t.occurredOn.desc()),
    index("ix_transactions_account").on(t.accountId),
    index("ix_transactions_category").on(t.categoryId),
    index("ix_transactions_budget").on(t.budgetId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
