/*
  Warnings:

  - A unique constraint covering the columns `[contact_no]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contact_no` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contact_no" TEXT NOT NULL,
ADD COLUMN     "sno" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_contact_no_key" ON "User"("contact_no");
