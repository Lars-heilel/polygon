-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" VARCHAR(2048) NOT NULL,
    "p256dh" VARCHAR(128) NOT NULL,
    "auth" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");
