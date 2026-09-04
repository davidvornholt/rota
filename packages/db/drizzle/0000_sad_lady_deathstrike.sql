CREATE TYPE "public"."garment_image_choice" AS ENUM('studio', 'original');--> statement-breakpoint
CREATE TYPE "public"."garment_image_kind" AS ENUM('original', 'studio');--> statement-breakpoint
CREATE TYPE "public"."garment_slot" AS ENUM('bottom', 'under', 'top', 'over');--> statement-breakpoint
CREATE TYPE "public"."garment_status" AS ENUM('processing', 'review', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'confirmed', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."wear_source" AS ENUM('proposed', 'override', 'backfill', 'edited');--> statement-breakpoint
CREATE TABLE "day_note" (
	"for_date" date PRIMARY KEY NOT NULL,
	"occasion" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "garment_status" DEFAULT 'processing' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"subcategory" text DEFAULT '' NOT NULL,
	"slots" "garment_slot"[] DEFAULT '{}' NOT NULL,
	"warmth" integer DEFAULT 3 NOT NULL,
	"rain_ok" boolean DEFAULT true NOT NULL,
	"formality" integer DEFAULT 3 NOT NULL,
	"wear_budget" integer,
	"colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pattern" text DEFAULT '' NOT NULL,
	"material" text DEFAULT '' NOT NULL,
	"fit" text DEFAULT '' NOT NULL,
	"sleeve" text DEFAULT '' NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"seasons" text[] DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"price" numeric(10, 2),
	"purchased_on" date,
	"image_choice" "garment_image_choice" DEFAULT 'studio' NOT NULL,
	"extraction" jsonb,
	"processing_error" text,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_warmth_range" CHECK ("garment"."warmth" between 1 and 5),
	CONSTRAINT "garment_formality_range" CHECK ("garment"."formality" between 1 and 5),
	CONSTRAINT "garment_wear_budget_positive" CHECK ("garment"."wear_budget" is null or "garment"."wear_budget" between 1 and 30)
);
--> statement-breakpoint
CREATE TABLE "garment_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"kind" "garment_image_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"for_date" date NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"location" jsonb,
	"cooldown_days" integer DEFAULT 7 NOT NULL,
	"category_budgets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"proposal_hour" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 'singleton'),
	CONSTRAINT "settings_cooldown_range" CHECK ("settings"."cooldown_days" between 0 and 60),
	CONSTRAINT "settings_proposal_hour_range" CHECK ("settings"."proposal_hour" between 0 and 23)
);
--> statement-breakpoint
CREATE TABLE "wear_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worn_on" date NOT NULL,
	"garment_id" uuid NOT NULL,
	"slot" "garment_slot" NOT NULL,
	"source" "wear_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_day" (
	"for_date" date PRIMARY KEY NOT NULL,
	"issued_on" date NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"location_label" text NOT NULL,
	"high" real NOT NULL,
	"low" real NOT NULL,
	"precipitation_probability" integer NOT NULL,
	"precipitation_mm" real NOT NULL,
	"wind_kmh" real NOT NULL,
	"weather_code" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garment_image" ADD CONSTRAINT "garment_image_garment_id_garment_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wear_log" ADD CONSTRAINT "wear_log_garment_id_garment_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garment_status_idx" ON "garment" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "garment_image_garment_kind_unique" ON "garment_image" USING btree ("garment_id","kind");--> statement-breakpoint
CREATE INDEX "proposal_for_date_idx" ON "proposal" USING btree ("for_date","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wear_log_day_slot_unique" ON "wear_log" USING btree ("worn_on","slot");--> statement-breakpoint
CREATE INDEX "wear_log_garment_idx" ON "wear_log" USING btree ("garment_id","worn_on");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_unique" ON "account" USING btree ("issuer","account_id");