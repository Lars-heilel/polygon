ALTER TABLE "Message"
  ADD COLUMN "forwarded_from_type" "MessageType",
  ADD COLUMN "forwarded_from_text" TEXT,
  ADD COLUMN "forwarded_from_file_name" TEXT;

UPDATE "Message" AS forwarded
SET
  "forwarded_from_type" = COALESCE(source."forwarded_from_type", source."type"),
  "forwarded_from_text" = COALESCE(source."forwarded_from_text", source."text"),
  "forwarded_from_file_name" = COALESCE(source."forwarded_from_file_name", source."file_name")
FROM "Message" AS source
WHERE forwarded."forwarded_from_id" = source."id"
  AND forwarded."forwarded_from_id" IS NOT NULL;
