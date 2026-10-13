import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Money stays a decimal string end to end; floats only appear for display maths.
export const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
