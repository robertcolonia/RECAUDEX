-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "analysisMode" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "groundingLevel" TEXT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
