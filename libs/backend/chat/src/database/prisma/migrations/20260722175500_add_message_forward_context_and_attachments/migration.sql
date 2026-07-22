CREATE TABLE "message_attachments" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "media_id" TEXT NOT NULL,
  "file_name_snapshot" TEXT,
  "file_size_snapshot" INTEGER,
  "mime_snapshot" TEXT,
  "category" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "message_forward_contexts" (
  "message_id" TEXT NOT NULL,
  "original_message_id" TEXT,
  "original_chat_id" TEXT,
  "original_author_id" TEXT NOT NULL,
  "original_author_name_snapshot" TEXT NOT NULL,
  "original_author_display_name_snapshot" TEXT,
  "original_message_created_at" TIMESTAMP(3) NOT NULL,
  "original_message_type" "MessageType" NOT NULL,
  "original_text_preview" TEXT,
  "original_file_name_preview" TEXT,
  "snapshot_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_forward_contexts_pkey" PRIMARY KEY ("message_id")
);

ALTER TABLE "message_attachments"
  ADD CONSTRAINT "message_attachments_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_forward_contexts"
  ADD CONSTRAINT "message_forward_contexts_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");
CREATE INDEX "message_attachments_media_id_idx" ON "message_attachments"("media_id");
CREATE INDEX "message_forward_contexts_original_author_id_idx" ON "message_forward_contexts"("original_author_id");
CREATE INDEX "message_forward_contexts_original_chat_id_idx" ON "message_forward_contexts"("original_chat_id");
