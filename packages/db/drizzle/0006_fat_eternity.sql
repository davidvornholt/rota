ALTER TYPE "public"."garment_slot" ADD VALUE 'shoes';--> statement-breakpoint
ALTER TYPE "public"."garment_slot" ADD VALUE 'bag';--> statement-breakpoint
CREATE TABLE "day_plan" (
	"owner_id" text NOT NULL,
	"for_date" date NOT NULL,
	"entries" jsonb,
	"clean_top" boolean,
	"based_on" text,
	"forecast" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_plan_owner_id_for_date_pk" PRIMARY KEY("owner_id","for_date")
);
--> statement-breakpoint
CREATE TABLE "saved_outfit" (
	"owner_id" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entries" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "washed_on" date;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "washed_after_wear" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "laundry_started_on" date;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "laundry_ready_on" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "clean_top_anchor" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "laundry_days" integer DEFAULT 4 NOT NULL;