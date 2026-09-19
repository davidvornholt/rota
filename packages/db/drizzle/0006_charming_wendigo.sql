ALTER TABLE "garment" ADD COLUMN "laundry_started_on" date;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "laundry_ready_on" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "laundry_days" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "garment" DROP COLUMN "in_laundry";