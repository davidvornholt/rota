CREATE TABLE "outfit_collage" (
	"owner_id" text NOT NULL,
	"pieces" text NOT NULL,
	"storage_key" text,
	"width" integer,
	"height" integer,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outfit_collage_owner_id_pieces_pk" PRIMARY KEY("owner_id","pieces"),
	CONSTRAINT "outfit_collage_outcome" CHECK (("outfit_collage"."storage_key" is not null and "outfit_collage"."width" is not null and "outfit_collage"."height" is not null and "outfit_collage"."error" is null) or ("outfit_collage"."storage_key" is null and "outfit_collage"."width" is null and "outfit_collage"."height" is null and "outfit_collage"."error" is not null))
);
