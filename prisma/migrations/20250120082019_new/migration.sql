/*
  Warnings:

  - Added the required column `config` to the `Vendor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "config" TEXT NOT NULL;
