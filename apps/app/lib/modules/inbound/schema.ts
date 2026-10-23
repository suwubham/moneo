import { sql } from "drizzle-orm";
import { char, date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, money, timestamps } from "../../db/columns";
import { accounts } from "../accounts/schema";
import { categories } from "../categories/schema";
import { profiles } from "../profiles/schema";
import { transactions } from "../transactions/schema";

// One private address per person: mail sent to <token>@<inbound domain> is theirs. A new token retires the old address.
export const inboxes = pgTable("inboxes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  ...timestamps(),
});

// What something in a bank email means, in the person's words: "Corner Store" → "Snacks, category Food",
// or "card ending 1234" → "my savings account". Every hint goes into the prompt that reads their emails.
export const inboxHints = pgTable(
  "inbox_hints",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    hint: text("hint").notNull(),
    ...timestamps(),
  },
  (t) => [index("ix_inbox_hints_user").on(t.userId), uniqueIndex("uq_inbox_hints_user_subject").on(t.userId, sql`lower(${t.subject})`)],
);

// - added: became a transaction
// - review: the model's reading did not pass every check, so it waits for the person, already filled in
// - unread: not a transaction (a statement, an offer, a code)
// - code: Gmail's forwarding confirmation, holding the code to paste back into Gmail
// - dismissed: the person put it away
export const inboxEmailStatuses = ["added", "review", "unread", "code", "dismissed"] as const;
export type InboxEmailStatus = (typeof inboxEmailStatuses)[number];

// Each email that reached a person's address. Only what was read out of it is kept, never the email itself.
// The provider's id is unique, so a webhook sent twice adds nothing the second time.
export const inboxEmails = pgTable(
  "inbox_emails",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull().unique(),
    status: text("status", { enum: inboxEmailStatuses }).notNull(),
    transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    // The model's reading. Amount is signed like a transaction: negative is money out.
    amount: money("amount"),
    currency: char("currency", { length: 3 }),
    occurredOn: date("occurred_on"),
    merchant: text("merchant"),
    description: text("description"),
    note: text("note"),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    code: text("code"),
    // Only the part after the @, so an email that was not a transaction can still be recognised.
    senderDomain: text("sender_domain"),
    ...timestamps(),
  },
  (t) => [index("ix_inbox_emails_user_created").on(t.userId, t.createdAt.desc())],
);

export type InboxEmail = typeof inboxEmails.$inferSelect;
export type InboxHint = typeof inboxHints.$inferSelect;
