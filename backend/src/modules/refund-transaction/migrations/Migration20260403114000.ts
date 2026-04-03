import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403114000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "refund_transaction" (
        "id" text not null,
        "return_id" text not null,
        "original_sale_id" text null,
        "shop_id" text not null,
        "refund_amount" numeric not null,
        "restocking_fee" numeric not null default 0,
        "shipping_refund" numeric not null default 0,
        "total_refund" numeric not null,
        "refund_method" text check ("refund_method" in ('mpesa', 'cash', 'store_credit', 'bank_transfer', 'original_payment')) not null default 'store_credit',
        "mpesa_receipt" text null,
        "bank_reference" text null,
        "store_credit_id" text null,
        "status" text check ("status" in ('pending', 'processing', 'completed', 'failed', 'cancelled')) not null default 'pending',
        "processed_by" text null,
        "processed_at" timestamptz null,
        "failed_reason" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "refund_transaction_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_refund_transaction_return_id"
      on "refund_transaction" ("return_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_refund_transaction_return_id";`)
    this.addSql(`drop table if exists "refund_transaction" cascade;`)
  }
}
