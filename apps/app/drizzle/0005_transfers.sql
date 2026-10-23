ALTER TABLE "transactions" ADD COLUMN "transfer_id" uuid;--> statement-breakpoint
CREATE INDEX "ix_transactions_transfer" ON "transactions" USING btree ("transfer_id");