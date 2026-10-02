-- Chat ids to uuid v7 (hand-rewritten): Prisma emits lossy DROP COLUMN / ADD COLUMN
-- for every TEXT->UUID change. This file instead casts in place, preserving all rows.
-- Template: drop FKs -> drop PKs -> ALTER TYPE ... USING col::uuid ->
-- SET DEFAULT uuidv7() on ids -> re-add PKs -> re-add FKs.
-- Indexes survive ALTER TYPE, so no CREATE INDEX (would error: already exist).
-- Two Prisma-requested renames are kept via ALTER INDEX ... RENAME (incl. the
-- Message(chat_id, created_at, id) index, renamed instead of drop+create).

-- DropForeignKey
ALTER TABLE "ChatMember" DROP CONSTRAINT "ChatMember_chat_id_fkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_chat_id_fkey";
ALTER TABLE "message_attachments" DROP CONSTRAINT "message_attachments_message_id_fkey";
ALTER TABLE "message_deletions" DROP CONSTRAINT "message_deletions_message_id_fkey";
ALTER TABLE "message_forward_contexts" DROP CONSTRAINT "message_forward_contexts_message_id_fkey";

-- Drop PKs (composite PKs include altered columns; single-col PKs dropped for safety)
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_pkey";
ALTER TABLE "ChatMember" DROP CONSTRAINT "ChatMember_pkey";
ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey";
ALTER TABLE "message_attachments" DROP CONSTRAINT "message_attachments_pkey";
ALTER TABLE "message_deletions" DROP CONSTRAINT "message_deletions_pkey";
ALTER TABLE "message_forward_contexts" DROP CONSTRAINT "message_forward_contexts_pkey";

-- Chat (3 cols)
ALTER TABLE "Chat" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Chat" ALTER COLUMN "self_owner_id" TYPE UUID USING "self_owner_id"::uuid;
ALTER TABLE "Chat" ALTER COLUMN "last_message_id" TYPE UUID USING "last_message_id"::uuid;
ALTER TABLE "Chat" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_pkey" PRIMARY KEY ("id");

-- ChatMember (3 cols)
ALTER TABLE "ChatMember" ALTER COLUMN "chat_id" TYPE UUID USING "chat_id"::uuid;
ALTER TABLE "ChatMember" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::uuid;
ALTER TABLE "ChatMember" ALTER COLUMN "last_read_message_id" TYPE UUID USING "last_read_message_id"::uuid;
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_pkey" PRIMARY KEY ("chat_id", "user_id");

-- Message (4 cols; client_id untouched text)
ALTER TABLE "Message" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Message" ALTER COLUMN "chat_id" TYPE UUID USING "chat_id"::uuid;
ALTER TABLE "Message" ALTER COLUMN "sender_id" TYPE UUID USING "sender_id"::uuid;
ALTER TABLE "Message" ALTER COLUMN "deleted_by_id" TYPE UUID USING "deleted_by_id"::uuid;
ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "Message" ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");

-- message_attachments (3 cols)
ALTER TABLE "message_attachments" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "message_attachments" ALTER COLUMN "message_id" TYPE UUID USING "message_id"::uuid;
ALTER TABLE "message_attachments" ALTER COLUMN "media_id" TYPE UUID USING "media_id"::uuid;
ALTER TABLE "message_attachments" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id");

-- message_deletions (2 cols)
ALTER TABLE "message_deletions" ALTER COLUMN "message_id" TYPE UUID USING "message_id"::uuid;
ALTER TABLE "message_deletions" ALTER COLUMN "user_id" TYPE UUID USING "user_id"::uuid;
ALTER TABLE "message_deletions" ADD CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("message_id", "user_id");

-- message_forward_contexts (4 cols)
ALTER TABLE "message_forward_contexts" ALTER COLUMN "message_id" TYPE UUID USING "message_id"::uuid;
ALTER TABLE "message_forward_contexts" ALTER COLUMN "original_message_id" TYPE UUID USING "original_message_id"::uuid;
ALTER TABLE "message_forward_contexts" ALTER COLUMN "original_chat_id" TYPE UUID USING "original_chat_id"::uuid;
ALTER TABLE "message_forward_contexts" ALTER COLUMN "original_author_id" TYPE UUID USING "original_author_id"::uuid;
ALTER TABLE "message_forward_contexts" ADD CONSTRAINT "message_forward_contexts_pkey" PRIMARY KEY ("message_id");

-- Index renames requested by Prisma (align with schema default names; rename preserves index)
ALTER INDEX "Chat_lastMessageAt_idx" RENAME TO "Chat_last_message_at_idx";
ALTER INDEX "Message_chatId_createdAt_id_idx" RENAME TO "Message_chat_id_created_at_id_idx";
ALTER INDEX "Message_chatId_clientId_partial_key" RENAME TO "Message_chat_id_client_id_key";

-- Re-add FKs
ALTER TABLE "ChatMember" ADD CONSTRAINT "ChatMember_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_forward_contexts" ADD CONSTRAINT "message_forward_contexts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_deletions" ADD CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
