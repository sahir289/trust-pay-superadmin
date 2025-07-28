/*
  Warnings:

  - You are about to drop the column `vendor_id` on the `BankAccount` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Payin` table. All the data in the column will be lost.
  - You are about to drop the column `tg_handle` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tg_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `merchant_id` on the `UserHierarchy` table. All the data in the column will be lost.
  - Added the required column `company_id` to the `AccessToken` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `access_token` on the `AccessToken` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `company_id` to the `BankAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `BankAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `BankResponse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Calculation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `ChargeBack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `CheckUtrHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Complaints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Designation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Merchant` table without a default value. This is not possible if the table is not empty.
  - Made the column `balance` on table `Merchant` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `company_id` to the `Payin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user` to the `Payin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Payout` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `ResetDataHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Settlement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `designation_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `UserHierarchy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role_id` to the `UserHierarchy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `company_id` to the `Vendor` table without a default value. This is not possible if the table is not empty.
  - Made the column `balance` on table `Vendor` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "BankAccount" DROP CONSTRAINT "BankAccount_vendor_id_fkey";

-- DropForeignKey
ALTER TABLE "Payin" DROP CONSTRAINT "Payin_user_id_fkey";

-- DropForeignKey
ALTER TABLE "UserHierarchy" DROP CONSTRAINT "UserHierarchy_merchant_id_fkey";

-- AlterTable
ALTER TABLE "AccessToken" ADD COLUMN     "company_id" TEXT NOT NULL,
DROP COLUMN "access_token",
ADD COLUMN     "access_token" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "BankAccount" DROP COLUMN "vendor_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "BankResponse" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Calculation" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ChargeBack" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CheckUtrHistory" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Complaints" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Designation" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "company_id" TEXT NOT NULL,
ALTER COLUMN "balance" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payin" DROP COLUMN "user_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "config" JSONB,
ADD COLUMN     "user" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ResetDataHistory" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "company_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "tg_handle",
DROP COLUMN "tg_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "designation_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserHierarchy" DROP COLUMN "merchant_id",
ADD COLUMN     "company_id" TEXT NOT NULL,
ADD COLUMN     "role_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "company_id" TEXT NOT NULL,
ALTER COLUMN "balance" SET NOT NULL;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contact_no" TEXT NOT NULL,
    "config" JSONB,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_email_key" ON "Company"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_contact_no_key" ON "Company"("contact_no");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "Designation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchy" ADD CONSTRAINT "UserHierarchy_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchy" ADD CONSTRAINT "UserHierarchy_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payin" ADD CONSTRAINT "Payin_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeBack" ADD CONSTRAINT "Chargeback_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankResponse" ADD CONSTRAINT "BankResponse_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckUtrHistory" ADD CONSTRAINT "CheckUtrHistory_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResetDataHistory" ADD CONSTRAINT "ResetDataHistory_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaints" ADD CONSTRAINT "Complaints_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
