-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY', 'DELETING');

-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('AVATAR', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'VOICE', 'CIRCLE');

-- CreateEnum
CREATE TYPE "MediaReferenceOwnerType" AS ENUM ('MESSAGE_ATTACHMENT');

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "key" VARCHAR(1024) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size" BIGINT NOT NULL,
    "url" VARCHAR(2048),
    "uploader_id" UUID,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "chat_id" UUID,
    "category" "FileCategory" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_references" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "owner_type" "MediaReferenceOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"("key");

-- CreateIndex
CREATE INDEX "files_uploader_id_idx" ON "files"("uploader_id");

-- CreateIndex
CREATE INDEX "files_chat_id_category_idx" ON "files"("chat_id", "category");

-- CreateIndex
CREATE INDEX "files_status_idx" ON "files"("status");

-- CreateIndex
CREATE INDEX "media_references_file_id_idx" ON "media_references"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_references_owner_type_owner_id_key" ON "media_references"("owner_type", "owner_id");

-- AddForeignKey
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
