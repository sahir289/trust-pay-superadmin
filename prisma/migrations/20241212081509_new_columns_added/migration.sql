/*
  Warnings:

  - Added the required column `status` to the `Complaints` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Complaints" ADD COLUMN     "sno" SERIAL NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL;
