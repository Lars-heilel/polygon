ALTER TABLE "Message"
  DROP COLUMN IF EXISTS "file_id",
  DROP COLUMN IF EXISTS "file_bucket",
  DROP COLUMN IF EXISTS "file_key",
  DROP COLUMN IF EXISTS "file_name",
  DROP COLUMN IF EXISTS "file_size",
  DROP COLUMN IF EXISTS "file_mime",
  DROP COLUMN IF EXISTS "file_category",
  DROP COLUMN IF EXISTS "forwarded_from_id",
  DROP COLUMN IF EXISTS "forwarded_from_sender_id",
  DROP COLUMN IF EXISTS "forwarded_from_created_at",
  DROP COLUMN IF EXISTS "forwarded_from_type",
  DROP COLUMN IF EXISTS "forwarded_from_text",
  DROP COLUMN IF EXISTS "forwarded_from_file_name";
