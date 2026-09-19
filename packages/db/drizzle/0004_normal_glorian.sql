CREATE TABLE "access_code" (
	"digest" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "access_code_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "admin_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"admin" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp DEFAULT now(),
	"aaguid" text,
	CONSTRAINT "passkey_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "api_price" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_per_million" numeric(14, 6) NOT NULL,
	"output_per_million" numeric(14, 6) NOT NULL,
	"image_input_per_million" numeric(14, 6) NOT NULL,
	"image_output_per_million" numeric(14, 6) NOT NULL,
	"cached_input_per_million" numeric(14, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"operation" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"usage" jsonb,
	"price_snapshot" jsonb,
	"estimated_usd" numeric(18, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_singleton";--> statement-breakpoint
DROP INDEX "wear_log_day_slot_unique";--> statement-breakpoint
ALTER TABLE "day_note" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "garment" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "wear_log" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "weather_day" ADD COLUMN "owner_id" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_code" ADD CONSTRAINT "access_code_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "settings_owner_unique" ON "settings" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wear_log_day_slot_unique" ON "wear_log" USING btree ("owner_id","worn_on","slot");