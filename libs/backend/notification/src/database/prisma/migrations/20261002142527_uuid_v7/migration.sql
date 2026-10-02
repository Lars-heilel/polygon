-- Safe TEXT -> UUID conversion (hand-rewritten; Prisma emitted lossy DROP/ADD COLUMN).
-- Pattern: drop PK -> ALTER TYPE ... USING col::uuid -> SET DEFAULT uuidv7() on id -> re-add PK.
-- No FKs on this table. Indexes (incl. uniques) survive ALTER TYPE, NOT recreated.
-- Pre-flight: 0 rows in PushSubscription, cast vacuously safe.

-- DropPrimaryKey
ALTER TABLE "PushSubscription" DROP CONSTRAINT "PushSubscription_pkey";

-- Alter id + userId with cast
ALTER TABLE "PushSubscription" ALTER COLUMN "id" TYPE UUID USING "id"::uuid;
ALTER TABLE "PushSubscription" ALTER COLUMN "id" SET DEFAULT uuidv7();
ALTER TABLE "PushSubscription" ALTER COLUMN "userId" TYPE UUID USING "userId"::uuid;

-- Re-add PK
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id");
