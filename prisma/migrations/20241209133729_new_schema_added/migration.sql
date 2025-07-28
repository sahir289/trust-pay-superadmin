-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ASSIGNED', 'SUCCESS', 'DROPPED', 'DUPLICATE', 'INITIATED', 'DISPUTE', 'REVERSED', 'IMG_PENDING', 'PENDING', 'REJECTED', 'TEST_SUCCESS', 'TEST_DROPPED', 'BANK_MISMATCH', 'FAILED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('INR');

-- CreateEnum
CREATE TYPE "Method" AS ENUM ('BANK', 'CASH', 'AED', 'CRYPTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tg_handle" TEXT,
    "tg_id" TEXT,
    "last_login" TIMESTAMP(3),
    "last_logout" TIMESTAMP(3),
    "vendor_id" TEXT NOT NULL,
    "config" JSONB,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "site_url" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "public_api_key" TEXT NOT NULL,
    "notify_url" TEXT,
    "return_url" TEXT NOT NULL,
    "min_payin" DECIMAL(65,30) NOT NULL,
    "max_payin" DECIMAL(65,30) NOT NULL,
    "payin_commission" DECIMAL(65,30) NOT NULL,
    "min_payout" DECIMAL(65,30) NOT NULL,
    "max_payout" DECIMAL(65,30) NOT NULL,
    "payout_commission" DECIMAL(65,30) NOT NULL,
    "payout_notify_url" TEXT,
    "is_test_mode" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "dispute_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "balance" DECIMAL(65,30),
    "config" JSONB NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "payin_commission" DECIMAL(65,30) NOT NULL,
    "payout_commission" DECIMAL(65,30) NOT NULL,
    "balance" DECIMAL(65,30),
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserHierarchy" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "config" JSONB,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserHierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "upi_id" TEXT NOT NULL,
    "upi_params" TEXT,
    "name" TEXT NOT NULL,
    "ac_no" DECIMAL(65,30) NOT NULL,
    "ac_name" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "is_qr" BOOLEAN NOT NULL DEFAULT true,
    "is_bank" BOOLEAN NOT NULL DEFAULT true,
    "min" DECIMAL(65,30) NOT NULL,
    "max" DECIMAL(65,30) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "payin_count" INTEGER NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,
    "bank_used_for" TEXT DEFAULT '',
    "config" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payin" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "upi_short_code" TEXT NOT NULL,
    "qr_params" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "Status" NOT NULL,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "user_submitted_utr" TEXT,
    "currency" "Currency" NOT NULL,
    "merchant_order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_acc_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "bank_response_id" TEXT NOT NULL,
    "payin_merchant_commission" DECIMAL(65,30),
    "payin_vendor_commission" DECIMAL(65,30),
    "user_submitted_image" TEXT,
    "duration" TEXT,
    "is_url_expires" BOOLEAN NOT NULL DEFAULT false,
    "expiration_date" INTEGER,
    "one_time_used" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Payin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "bank_acc_id" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "Status" NOT NULL,
    "failed_reason" TEXT,
    "currency" "Currency" NOT NULL,
    "merchant_order_id" TEXT NOT NULL,
    "acc_no" TEXT NOT NULL,
    "acc_holder_name" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "bank_name" TEXT,
    "upi_id" TEXT,
    "utr_id" TEXT,
    "notify_url" TEXT,
    "rejected_reason" TEXT,
    "payout_merchant_commission" DECIMAL(65,30) NOT NULL,
    "payout_vendor_commission" DECIMAL(65,30) NOT NULL,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "Method" NOT NULL,
    "config" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calculation" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "vendor_id" TEXT,
    "total_payin_count" INTEGER NOT NULL DEFAULT 0,
    "total_payin_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_payin_commission" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_payout_count" INTEGER NOT NULL DEFAULT 0,
    "total_payout_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_payout_commission" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_settlement_count" INTEGER NOT NULL DEFAULT 0,
    "total_settlement_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "total_lien_count" INTEGER NOT NULL DEFAULT 0,
    "total_lien_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "current_balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "net_balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Calculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lien" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "payin_id" TEXT NOT NULL,
    "bank_acc_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "when" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankResponse" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "status" "Status" NOT NULL,
    "bank_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "upi_short_code" TEXT,
    "utr" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BankResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckUtrHistory" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "payin_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CheckUtrHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResetDataHistory" (
    "id" TEXT NOT NULL,
    "sno" SERIAL NOT NULL,
    "payin_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_obsolete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResetDataHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaints" (
    "id" TEXT NOT NULL,
    "payin_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_user_name_key" ON "User"("user_name");

-- CreateIndex
CREATE UNIQUE INDEX "User_code_key" ON "User"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_api_key_key" ON "Merchant"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_secret_key_key" ON "Merchant"("secret_key");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_code_key" ON "Vendor"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Designation" ADD CONSTRAINT "Designation_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchy" ADD CONSTRAINT "UserHierarchy_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserHierarchy" ADD CONSTRAINT "UserHierarchy_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payin" ADD CONSTRAINT "Payin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payin" ADD CONSTRAINT "Payin_bank_acc_id_fkey" FOREIGN KEY ("bank_acc_id") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payin" ADD CONSTRAINT "Payin_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payin" ADD CONSTRAINT "Payin_bank_response_id_fkey" FOREIGN KEY ("bank_response_id") REFERENCES "BankResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_from_bank_acc_id_fkey" FOREIGN KEY ("from_bank_acc_id") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calculation" ADD CONSTRAINT "Calculation_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lien" ADD CONSTRAINT "Lien_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lien" ADD CONSTRAINT "Lien_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lien" ADD CONSTRAINT "Lien_payin_id_fkey" FOREIGN KEY ("payin_id") REFERENCES "Payin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lien" ADD CONSTRAINT "Lien_bank_acc_id_fkey" FOREIGN KEY ("bank_acc_id") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankResponse" ADD CONSTRAINT "BankResponse_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckUtrHistory" ADD CONSTRAINT "CheckUtrHistory_payin_id_fkey" FOREIGN KEY ("payin_id") REFERENCES "Payin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResetDataHistory" ADD CONSTRAINT "ResetDataHistory_payin_id_fkey" FOREIGN KEY ("payin_id") REFERENCES "Payin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaints" ADD CONSTRAINT "Complaints_payin_id_fkey" FOREIGN KEY ("payin_id") REFERENCES "Payin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
