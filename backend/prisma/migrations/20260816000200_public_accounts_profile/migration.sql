ALTER TABLE "Organization" ADD COLUMN "taxId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Organization_taxId_key" ON "Organization"("taxId");

CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountAlias" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberLast4" TEXT NOT NULL,
    "accountFingerprint" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankAccount_organizationId_accountFingerprint_key" ON "BankAccount"("organizationId", "accountFingerprint");
CREATE INDEX "BankAccount_organizationId_active_bankName_idx" ON "BankAccount"("organizationId", "active", "bankName");
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
