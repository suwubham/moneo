CREATE TABLE "assistant_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" uuid,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"view" jsonb NOT NULL,
	"target_updated_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "images" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_changes" ADD CONSTRAINT "assistant_changes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_changes" ADD CONSTRAINT "assistant_changes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_assistant_changes_message" ON "assistant_changes" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "ix_assistant_changes_user" ON "assistant_changes" USING btree ("user_id");