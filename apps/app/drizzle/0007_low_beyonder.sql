CREATE TABLE "assistant_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"bytes" integer NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "data" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_files" ADD CONSTRAINT "assistant_files_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_files" ADD CONSTRAINT "assistant_files_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_files" ADD CONSTRAINT "assistant_files_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_assistant_files_user_created" ON "assistant_files" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_assistant_files_message" ON "assistant_files" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "ix_assistant_files_conversation" ON "assistant_files" USING btree ("conversation_id");