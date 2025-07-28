/*
  Warnings:

  - You are about to drop the column `vendor_id` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_vendor_id_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "vendor_id";

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
