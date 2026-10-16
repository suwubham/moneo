import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { id, money, timestamps } from "../../db/columns";
import { profiles } from "../profiles/schema";
import { type AccountKind, accountKinds } from "./constants";

export { accountKinds, type AccountKind };

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: accountKinds }).notNull(),
    openingBalance: money("opening_balance").notNull().default("0"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    // Keys from constants.ts; null means the default for the kind.
    icon: text("icon"),
    color: text("color"),
    // Lower comes first; ties fall back to when the account was added.
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("ix_accounts_user").on(t.userId)],
);

export type Account = typeof accounts.$inferSelect;
