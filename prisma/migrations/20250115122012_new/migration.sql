/*
  Warnings:

  - You are about to drop the column `merchant_id` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `total_lien_amount` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `total_lien_count` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_id` on the `Calculation` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_id` on the `Payout` table. All the data in the column will be lost.
  - You are about to drop the column `merchant_id` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `vendor_id` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the `Lien` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `user_id` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Settlement` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Calculation" DROP CONSTRAINT "Calculation_merchant_id_fkey";

-- DropForeignKey
ALTER TABLE "Calculation" DROP CONSTRAINT "Calculation_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "Lien" DROP CONSTRAINT "Lien_bank_acc_id_fkey";

-- DropForeignKey
ALTER TABLE "Lien" DROP CONSTRAINT "Lien_merchant_id_fkey";

-- DropForeignKey
ALTER TABLE "Lien" DROP CONSTRAINT "Lien_payin_id_fkey";

-- DropForeignKey
ALTER TABLE "Lien" DROP CONSTRAINT "Lien_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Payout" DROP CONSTRAINT "Payout_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_merchant_id_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_vendor_id_fkey";

-- AlterTable
ALTER TABLE "Calculation" DROP COLUMN "merchant_id",
DROP COLUMN "total_lien_amount",
DROP COLUMN "total_lien_count",
DROP COLUMN "vendor_id",
ADD COLUMN     "total_chargeback_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "total_chargeback_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payout" DROP COLUMN "vendor_id",
ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "merchant_id",
DROP COLUMN "vendor_id",
ADD COLUMN     "user_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "Lien";

-- CreateTable
CREATE TABLE "ChargeBack" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "user" TEXT NOT NULL,
    "merchant_user_id" TEXT NOT NULL,
    "vendor_user_id" TEXT NOT NULL,
    "payin_id" TEXT NOT NULL,
    "bank_acc_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "when" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBack" ADD CONSTRAINT "Chargeback_merchant_user_id_fkey" FOREIGN KEY ("merchant_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBack" ADD CONSTRAINT "Chargeback_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBack" ADD CONSTRAINT "Chargeback_payin_id_fkey" FOREIGN KEY ("payin_id") REFERENCES "Payin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBack" ADD CONSTRAINT "Chargeback_bank_acc_id_fkey" FOREIGN KEY ("bank_acc_id") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
