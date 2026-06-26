/*
  Warnings:

  - You are about to drop the `MessageAttachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MessageAttachment" DROP CONSTRAINT "MessageAttachment_message_id_fkey";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "file_category" TEXT;

-- DropTable
DROP TABLE "MessageAttachment";

-- DropEnum
DROP TYPE "AttachmentType";
