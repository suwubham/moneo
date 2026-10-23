import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "../../db/columns";
import { conversations, messages } from "../assistant/schema";
import { profiles } from "../profiles/schema";

export const fileKinds = ["html", "csv", "json"] as const;
export type FileKind = (typeof fileKinds)[number];

// A chart, report or widget a sandbox script made. The bytes live in R2 under `key`; this row says whose it is.
export const assistantFiles = pgTable(
  "assistant_files",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Empty until the turn that made it is saved.
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: fileKinds }).notNull(),
    bytes: integer("bytes").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_assistant_files_user_created").on(t.userId, t.createdAt),
    index("ix_assistant_files_message").on(t.messageId),
    index("ix_assistant_files_conversation").on(t.conversationId),
  ],
);

export type AssistantFile = typeof assistantFiles.$inferSelect;
