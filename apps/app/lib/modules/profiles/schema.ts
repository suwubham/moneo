import { char, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "../../db/columns";

// One row per Clerk user. The id is Clerk's user id, so no personal data is copied here.
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  currency: char("currency", { length: 3 }).notNull().default("USD"),
  ...timestamps(),
});

export type Profile = typeof profiles.$inferSelect;
