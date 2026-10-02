-- Auth ids to uuid v7 (hand-fixed: Prisma generated DROP/ADD COLUMN which
-- would lose data; rewritten as ALTER TYPE ... USING ...::uuid preserving rows)
-- Every id/reference ALTER TYPE carries USING col::uuid; defaults are uuidv7().

-- DropForeignKey
ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_credentials_id_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_credentialsId_fkey";

-- Credentials: TEXT -> UUID preserving data
ALTER TABLE "Credentials" DROP CONSTRAINT "Credentials_pkey";
ALTER TABLE "Credentials" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Credentials" ALTER COLUMN "banned_by" TYPE UUID USING "banned_by"::uuid;
ALTER TABLE "Credentials" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "Credentials" ADD CONSTRAINT "Credentials_pkey" PRIMARY KEY ("id");

-- OAuthAccount: TEXT -> UUID preserving data
ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_pkey";
ALTER TABLE "OAuthAccount" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "OAuthAccount" ALTER COLUMN "credentials_id" TYPE UUID USING "credentials_id"::uuid;
ALTER TABLE "OAuthAccount" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id");

-- Session: TEXT -> UUID preserving data
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey";
ALTER TABLE "Session" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "Session" ALTER COLUMN "credentialsId" TYPE UUID USING "credentialsId"::uuid;
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "Session" ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_credentials_id_fkey" FOREIGN KEY ("credentials_id") REFERENCES "Credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_credentialsId_fkey" FOREIGN KEY ("credentialsId") REFERENCES "Credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
