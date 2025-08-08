-- CreateTable
CREATE TABLE "token_addresses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_addresses" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TokenAllowances" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_addresses_address_chainId_key" ON "wallet_addresses"("address", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "_TokenAllowances_AB_unique" ON "_TokenAllowances"("A", "B");

-- CreateIndex
CREATE INDEX "_TokenAllowances_B_index" ON "_TokenAllowances"("B");

-- AddForeignKey
ALTER TABLE "_TokenAllowances" ADD CONSTRAINT "_TokenAllowances_A_fkey" FOREIGN KEY ("A") REFERENCES "token_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TokenAllowances" ADD CONSTRAINT "_TokenAllowances_B_fkey" FOREIGN KEY ("B") REFERENCES "wallet_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
