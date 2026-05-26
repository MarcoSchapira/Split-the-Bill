-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "user_a_id" TEXT NOT NULL,
    "user_b_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_invitations" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "friend_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_invitations" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incurred_at" TIMESTAMP(3) NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "target_type" TEXT NOT NULL,
    "friendship_id" TEXT,
    "group_id" TEXT,
    "payer_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_shares" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "share_cents" INTEGER NOT NULL,

    CONSTRAINT "bill_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "bill_id" TEXT,
    "friend_invitation_id" TEXT,
    "group_invitation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_recipients" (
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "activity_recipients_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "friendships_user_a_id_user_b_id_key" ON "friendships"("user_a_id", "user_b_id");
CREATE INDEX "friendships_user_a_id_idx" ON "friendships"("user_a_id");
CREATE INDEX "friendships_user_b_id_idx" ON "friendships"("user_b_id");
CREATE INDEX "friend_invitations_sender_id_idx" ON "friend_invitations"("sender_id");
CREATE INDEX "friend_invitations_recipient_id_idx" ON "friend_invitations"("recipient_id");
CREATE INDEX "friend_invitations_status_idx" ON "friend_invitations"("status");
CREATE INDEX "group_invitations_group_id_idx" ON "group_invitations"("group_id");
CREATE INDEX "group_invitations_sender_id_idx" ON "group_invitations"("sender_id");
CREATE INDEX "group_invitations_recipient_id_idx" ON "group_invitations"("recipient_id");
CREATE INDEX "group_invitations_status_idx" ON "group_invitations"("status");
CREATE INDEX "bills_friendship_id_idx" ON "bills"("friendship_id");
CREATE INDEX "bills_group_id_idx" ON "bills"("group_id");
CREATE INDEX "bills_payer_id_idx" ON "bills"("payer_id");
CREATE INDEX "bills_creator_id_idx" ON "bills"("creator_id");
CREATE INDEX "bills_deleted_at_idx" ON "bills"("deleted_at");
CREATE UNIQUE INDEX "bill_shares_bill_id_user_id_key" ON "bill_shares"("bill_id", "user_id");
CREATE INDEX "bill_shares_user_id_idx" ON "bill_shares"("user_id");
CREATE INDEX "activity_events_actor_id_idx" ON "activity_events"("actor_id");
CREATE INDEX "activity_events_created_at_idx" ON "activity_events"("created_at");
CREATE INDEX "activity_recipients_user_id_idx" ON "activity_recipients"("user_id");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_invitations" ADD CONSTRAINT "friend_invitations_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_friendship_id_fkey" FOREIGN KEY ("friendship_id") REFERENCES "friendships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bill_shares" ADD CONSTRAINT "bill_shares_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bill_shares" ADD CONSTRAINT "bill_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_friend_invitation_id_fkey" FOREIGN KEY ("friend_invitation_id") REFERENCES "friend_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_group_invitation_id_fkey" FOREIGN KEY ("group_invitation_id") REFERENCES "group_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_recipients" ADD CONSTRAINT "activity_recipients_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_recipients" ADD CONSTRAINT "activity_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
