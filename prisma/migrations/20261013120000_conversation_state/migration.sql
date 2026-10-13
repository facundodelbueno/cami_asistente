CREATE TABLE IF NOT EXISTS "ConversationState" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "phone" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "state" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationState_phone_key" ON "ConversationState"("phone");
CREATE INDEX IF NOT EXISTS "ConversationState_context_updatedAt_idx" ON "ConversationState"("context", "updatedAt");
