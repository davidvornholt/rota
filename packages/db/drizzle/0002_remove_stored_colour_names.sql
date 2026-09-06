UPDATE "garment"
SET "colors" = (
  SELECT jsonb_agg(colour.value - 'name' ORDER BY colour.position)
  FROM jsonb_array_elements("garment"."colors") WITH ORDINALITY AS colour(value, position)
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements("garment"."colors") AS colour(value)
  WHERE colour.value ? 'name'
);
