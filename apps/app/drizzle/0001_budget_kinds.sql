ALTER TABLE "budgets" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "budget_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "exclude_from_budgets" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "kind" text DEFAULT 'category' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_transactions_budget" ON "transactions" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "ix_budgets_user" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budgets_user_total" ON "budgets" USING btree ("user_id") WHERE "budgets"."kind" = 'total';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_budgets_user_picked_name" ON "budgets" USING btree ("user_id",lower("name")) WHERE "budgets"."kind" = 'picked';--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "ck_budgets_shape" CHECK (("budgets"."kind" = 'category') = ("budgets"."category_id" is not null) and ("budgets"."kind" = 'picked') = ("budgets"."name" is not null));