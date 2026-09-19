ALTER TYPE "public"."garment_slot" ADD VALUE 'shoes';--> statement-breakpoint
ALTER TYPE "public"."garment_slot" ADD VALUE 'bag';--> statement-breakpoint
CREATE TABLE "day_plan" (
	"for_date" date PRIMARY KEY NOT NULL,
	"entries" jsonb,
	"clean_top" boolean,
	"based_on" text,
	"forecast" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_outfit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"entries" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "washed_on" date;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "in_laundry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "clean_top_anchor" date;