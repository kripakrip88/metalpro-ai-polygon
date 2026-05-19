CREATE TABLE "email_messages" (
  "id"           TEXT NOT NULL,
  "messageId"    TEXT NOT NULL,
  "threadId"     TEXT,
  "fromAddress"  TEXT NOT NULL,
  "toAddress"    TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "bodyText"     TEXT NOT NULL,
  "receivedAt"   TIMESTAMP(3) NOT NULL,
  "aiIntent"     TEXT,
  "aiPriority"   TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "aiSummary"    TEXT,
  "aiExtracted"  JSONB,
  "aiDrafts"     JSONB,
  "aiSuggestRfq" BOOLEAN NOT NULL DEFAULT false,
  "aiModelUsed"  TEXT,
  "status"       TEXT NOT NULL DEFAULT '"'"'pending'"'"',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_messages_messageId_key" ON "email_messages"("messageId");
CREATE INDEX "email_messages_status_idx" ON "email_messages"("status");
CREATE INDEX "email_messages_aiIntent_idx" ON "email_messages"("aiIntent");