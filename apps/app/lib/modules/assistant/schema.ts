import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_messages_conversation").on(t.conversationId, t.createdAt),
    index("ix_messages_user_created").on(t.userId, t.createdAt),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
