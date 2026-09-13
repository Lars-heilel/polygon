-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "name" VARCHAR(128),
    "avatar_url" VARCHAR(2048),
    "self_owner_id" UUID,
    "direct_key" VARCHAR(128),
    "last_message_id" BIGINT,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_members" (
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ChatRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_message_id" BIGINT,
    "last_read_at" TIMESTAMPTZ(3),

    CONSTRAINT "chat_members_pkey" PRIMARY KEY ("chat_id","user_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" BIGSERIAL NOT NULL,
    "client_id" VARCHAR(128),
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "has_link" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" BIGINT NOT NULL,
    "media_id" UUID NOT NULL,
    "file_name_snapshot" VARCHAR(255),
    "file_size_snapshot" BIGINT,
    "mime_snapshot" VARCHAR(127),
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_forward_contexts" (
    "message_id" BIGINT NOT NULL,
    "original_message_id" BIGINT,
    "original_chat_id" UUID,
    "original_author_id" UUID NOT NULL,
    "original_author_name_snapshot" VARCHAR(32) NOT NULL,
    "original_author_display_name_snapshot" VARCHAR(64),
    "original_message_created_at" TIMESTAMPTZ(3) NOT NULL,
    "original_message_type" TEXT NOT NULL,
    "original_text_preview" VARCHAR(280),
    "original_file_name_preview" VARCHAR(255),
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_forward_contexts_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "message_deletions" (
    "message_id" BIGINT NOT NULL,
    "user_id" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chats_self_owner_id_key" ON "chats"("self_owner_id");

-- CreateIndex
CREATE INDEX "chats_type_idx" ON "chats"("type");

-- CreateIndex
CREATE INDEX "chats_last_message_at_id_idx" ON "chats"("last_message_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "chats_direct_key_key" ON "chats"("direct_key");

-- CreateIndex
CREATE INDEX "chat_members_user_id_idx" ON "chat_members"("user_id");

-- CreateIndex
CREATE INDEX "chat_members_user_id_chat_id_idx" ON "chat_members"("user_id", "chat_id");

-- CreateIndex
CREATE INDEX "chat_members_chat_id_last_read_at_idx" ON "chat_members"("chat_id", "last_read_at");

-- CreateIndex
CREATE INDEX "messages_chat_id_created_at_id_idx" ON "messages"("chat_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "messages_deleted_at_idx" ON "messages"("deleted_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_chat_id_client_id_key" ON "messages"("chat_id", "client_id");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_idx" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "message_attachments_media_id_idx" ON "message_attachments"("media_id");

-- CreateIndex
CREATE INDEX "message_forward_contexts_original_author_id_idx" ON "message_forward_contexts"("original_author_id");

-- CreateIndex
CREATE INDEX "message_forward_contexts_original_chat_id_idx" ON "message_forward_contexts"("original_chat_id");

-- CreateIndex
CREATE INDEX "message_deletions_user_id_idx" ON "message_deletions"("user_id");

-- AddForeignKey
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_forward_contexts" ADD CONSTRAINT "message_forward_contexts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_deletions" ADD CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
