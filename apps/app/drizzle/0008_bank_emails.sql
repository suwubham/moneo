CREATE TABLE "inbox_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"status" text NOT NULL,
	"transaction_id" uuid,
	"amount" numeric(14, 2),
	"currency" char(3),
	"occurred_on" date,
	"merchant" text,
	"description" text,
	"note" text,
	"account_id" uuid,
	"category_id" uuid,
	"code" text,
	"sender_domain" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_emails_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inboxes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_emails" ADD CONSTRAINT "inbox_emails_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_hints" ADD CONSTRAINT "inbox_hints_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inbox_emails_user_created" ON "inbox_emails" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ix_inbox_hints_user" ON "inbox_hints" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inbox_hints_user_subject" ON "inbox_hints" USING btree ("user_id",lower("subject"));