import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "../../db/columns";
import { profiles } from "../profiles/schema";

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...timestamps(),
  },
  (t) => [index("ix_conversations_user_updated").on(t.userId, t.updatedAt.desc())],
);

export const messageRoles = ["user", "assistant"] as const;
export type MessageRole = (typeof messageRoles)[number];

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Denormalised so the hourly limit is one indexed count, not a join.
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: text("role", { enum: messageRoles }).notNull(),
    content: text("content").notNull(),
    tools: jsonb("tools").$type<string[]>().notNull().default([]),
    // One line per data file this turn saved to the chat's sandbox, so later turns know what is there.
    data: jsonb("data").$type<string[]>().notNull().default([]),
    // How many pictures came with a user message. The pictures go to the model for that turn only and are not kept.
    images: integer("images").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_messages_conversation").on(t.conversationId, t.createdAt),
    index("ix_messages_user_created").on(t.userId, t.createdAt),
  ],
);

export const changeKinds = ["add_transaction", "edit_transaction", "delete_transaction", "add_account", "edit_account", "delete_account"] as const;
export type ChangeKind = (typeof changeKinds)[number];

export const changeStatuses = ["pending", "saved", "skipped"] as const;
export type ChangeStatus = (typeof changeStatuses)[number];

// A change the assistant suggested. Nothing is written to accounts or transactions until the person saves it.
export const assistantChanges = pgTable(
  "assistant_changes",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: changeKinds }).notNull(),
    // The transaction or account it changes or deletes. Null for an add.
    targetId: uuid("target_id"),
    // The checked input for the service call, and what the card shows (with the old values for an edit).
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    view: jsonb("view").$type<Record<string, unknown>>().notNull(),
    // When the target was last changed as the suggestion was made. Saving stops if it changed since.
    targetUpdatedAt: timestamp("target_updated_at", { withTimezone: true }),
    status: text("status", { enum: changeStatuses }).notNull().default("pending"),
    ...timestamps(),
  },
  (t) => [index("ix_assistant_changes_message").on(t.messageId), index("ix_assistant_changes_user").on(t.userId)],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AssistantChange = typeof assistantChanges.$inferSelect;
