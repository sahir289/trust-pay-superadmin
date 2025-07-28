/*
  Warnings:

  - You are about to drop the column `sno` on the `User` table. All the data in the column will be lost.
  - Added the required column `today_balance` to the `BankAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `utr` to the `CheckUtrHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "sno" SERIAL NOT NULL,
ADD COLUMN     "today_balance" DECIMAL(65,30) NOT NULL;

-- AlterTable
ALTER TABLE "CheckUtrHistory" ADD COLUMN     "utr" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "sno" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "sno";
