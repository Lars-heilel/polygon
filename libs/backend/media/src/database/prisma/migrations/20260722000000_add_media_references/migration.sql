-- CreateEnum
CREATE TYPE "MediaReferenceOwnerType" AS ENUM ('MESSAGE_ATTACHMENT');

-- CreateTable
CREATE TABLE "media_references" (
    "id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "owner_type" "MediaReferenceOwnerType" NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_references_owner_type_owner_id_key" ON "media_references"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "media_references_file_id_idx" ON "media_references"("file_id");

-- AddForeignKey
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
