-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "e2ee_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "message_envelopes" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "recipient_device_id" UUID NOT NULL,
    "envelope_json" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "device_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "identity_key" TEXT NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "one_time_prekeys" (
    "id" BIGSERIAL NOT NULL,
    "device_id" UUID NOT NULL,
    "prekey" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "one_time_prekeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_prekeys" (
    "device_id" UUID NOT NULL,
    "signed_prekey" TEXT NOT NULL,
    "signed_prekey_signature" TEXT NOT NULL,

    CONSTRAINT "signed_prekeys_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "sender_key_shares" (
    "chat_id" UUID NOT NULL,
    "chain_key_id" UUID NOT NULL,
    "sender_device_id" UUID NOT NULL,
    "recipient_device_id" UUID NOT NULL,
    "wrapped_chain_key" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sender_key_shares_pkey" PRIMARY KEY ("chat_id","chain_key_id","recipient_device_id")
);

-- CreateIndex
CREATE INDEX "message_envelopes_message_id_idx" ON "message_envelopes"("message_id");

-- CreateIndex
CREATE INDEX "message_envelopes_recipient_device_id_idx" ON "message_envelopes"("recipient_device_id");

-- CreateIndex
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "one_time_prekeys_device_id_consumed_idx" ON "one_time_prekeys"("device_id", "consumed");

-- CreateIndex
CREATE INDEX "sender_key_shares_chat_id_recipient_device_id_idx" ON "sender_key_shares"("chat_id", "recipient_device_id");

-- CreateIndex
CREATE INDEX "sender_key_shares_chat_id_sender_device_id_created_at_idx" ON "sender_key_shares"("chat_id", "sender_device_id", "created_at");

-- AddForeignKey
ALTER TABLE "message_envelopes" ADD CONSTRAINT "message_envelopes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
