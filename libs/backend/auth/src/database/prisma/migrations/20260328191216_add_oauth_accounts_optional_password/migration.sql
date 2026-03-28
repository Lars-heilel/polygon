-- AlterTable
ALTER TABLE "Credentials" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "credentials_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAccount_credentials_id_idx" ON "OAuthAccount"("credentials_id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_provider_id_key" ON "OAuthAccount"("provider", "provider_id");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_credentials_id_fkey" FOREIGN KEY ("credentials_id") REFERENCES "Credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
