-- AlterTable
ALTER TABLE "FuelingSession" ADD COLUMN     "lastTickAt" TIMESTAMP(3),
ADD COLUMN     "limitLiters" DOUBLE PRECISION,
ADD COLUMN     "refundUzs" INTEGER;
