UPDATE "Message" AS forwarded
SET
  "forwarded_from_sender_id" = COALESCE(forwarded."forwarded_from_sender_id", source."forwarded_from_sender_id", source."sender_id"),
  "forwarded_from_created_at" = COALESCE(forwarded."forwarded_from_created_at", source."forwarded_from_created_at", source."created_at"),
  "forwarded_from_type" = COALESCE(forwarded."forwarded_from_type", source."forwarded_from_type", source."type"),
  "forwarded_from_text" = COALESCE(forwarded."forwarded_from_text", source."forwarded_from_text", source."text"),
  "forwarded_from_file_name" = COALESCE(forwarded."forwarded_from_file_name", source."forwarded_from_file_name", source."file_name")
FROM "Message" AS source
WHERE forwarded."forwarded_from_id" = source."id"
  AND forwarded."forwarded_from_id" IS NOT NULL
  AND (
    forwarded."forwarded_from_sender_id" IS NULL
    OR forwarded."forwarded_from_created_at" IS NULL
    OR forwarded."forwarded_from_type" IS NULL
    OR forwarded."forwarded_from_text" IS NULL
    OR forwarded."forwarded_from_file_name" IS NULL
  );
