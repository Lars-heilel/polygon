-- DropIndex
DROP INDEX "Credentials_email_idx";

-- AlterTable
ALTER TABLE "Credentials" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
