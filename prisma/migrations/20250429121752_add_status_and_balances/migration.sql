-- AlterTable
ALTER TABLE "wallet_addresses" ADD COLUMN     "executionStatus" JSONB DEFAULT '{}',
ADD COLUMN     "tokenBalances" JSONB DEFAULT '{}';
