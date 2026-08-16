ALTER TABLE "Message"
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "mode" TEXT,
ADD COLUMN "inputTokens" INTEGER,
ADD COLUMN "outputTokens" INTEGER,
ADD COLUMN "totalTokens" INTEGER,
ADD COLUMN "latencyMs" INTEGER;

CREATE INDEX "Message_provider_createdAt_idx" ON "Message"("provider", "createdAt");
