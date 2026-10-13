CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'PAYMENT_PENDING', 'PAYMENT_PROOF_RECEIVED', 'PAID', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "PaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "Client" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "defaultSessionPrice" INTEGER NOT NULL,
  "defaultSessionDuration" INTEGER NOT NULL DEFAULT 60,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "price" INTEGER NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
  "paymentReminderSentAt" TIMESTAMP(3),
  "paymentConfirmedAt" TIMESTAMP(3),
  "googleEventId" TEXT,
  "meetUrl" TEXT,
  "postSessionReminderSentAt" TIMESTAMP(3),
  "preSessionSummarySentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionNote" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "rawText" TEXT NOT NULL,
  "aiSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentProof" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "PaymentProofStatus" NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "direction" "MessageDirection" NOT NULL,
  "phone" TEXT NOT NULL,
  "clientId" UUID,
  "sessionId" UUID,
  "providerMessageId" TEXT,
  "messageType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_phone_key" ON "Client"("phone");
CREATE INDEX "Client_firstName_lastName_idx" ON "Client"("firstName", "lastName");
CREATE INDEX "Session_clientId_scheduledAt_idx" ON "Session"("clientId", "scheduledAt");
CREATE INDEX "Session_status_scheduledAt_idx" ON "Session"("status", "scheduledAt");
CREATE INDEX "SessionNote_clientId_createdAt_idx" ON "SessionNote"("clientId", "createdAt");
CREATE INDEX "PaymentProof_sessionId_status_idx" ON "PaymentProof"("sessionId", "status");
CREATE UNIQUE INDEX "MessageLog_providerMessageId_key" ON "MessageLog"("providerMessageId");
CREATE INDEX "MessageLog_phone_createdAt_idx" ON "MessageLog"("phone", "createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
