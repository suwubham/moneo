ALTER TABLE "accounts" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;