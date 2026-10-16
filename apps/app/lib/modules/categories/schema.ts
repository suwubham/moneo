import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { id, timestamps } from "../../db/columns";
import { profiles } from "../profiles/schema";

export const categoryKinds = ["expense", "income"] as const;
export type CategoryKind = (typeof categoryKinds)[number];

export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: categoryKinds }).notNull(),
    // Keys from look.ts. Null means "guess from the name".
    icon: text("icon"),
    color: text("color"),
    // The person's own order within spending or income; ties fall back to the name.
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("ix_categories_user").on(t.userId),
    uniqueIndex("uq_categories_user_name").on(t.userId, sql`lower(${t.name})`),
  ],
);

export type Category = typeof categories.$inferSelect;
