CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'CHARGE_CONFIRMED', 'RESCHEDULE_EXCEPTION', 'MANUAL_RESPONSE', 'CANCELLED_ALLOWED');

CREATE TABLE "CancellationRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "clientMessage" TEXT NOT NULL,
  "hoursBeforeSession" DOUBLE PRECISION NOT NULL,
  "withinCancellationWindow" BOOLEAN NOT NULL,
  "status" "CancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CancellationRequest_status_createdAt_idx" ON "CancellationRequest"("status", "createdAt");
CREATE INDEX "CancellationRequest_clientId_createdAt_idx" ON "CancellationRequest"("clientId", "createdAt");
CREATE INDEX "CancellationRequest_sessionId_idx" ON "CancellationRequest"("sessionId");

ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
