import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401123500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop table if exists "payment_transaction" cascade;`)
  }

  override async down(): Promise<void> {
    this.addSql(`
      create table if not exists "payment_transaction" (
        "id" text not null,
        "shop_id" text not null,
        "order_id" text null,
        "sale_snapshot_id" text null,
        "mpesa_receipt_number" text null,
        "transaction_id" text not null,
        "phone_number" text not null,
        "amount" numeric not null,
        "raw_amount" jsonb not null default '{"value":"0","precision":20}',
        "currency" text not null default 'KES',
        "status" text not null default 'pending',
        "payment_type" text not null,
        "daraja_request" jsonb null,
        "daraja_response" jsonb null,
        "callback_metadata" jsonb null,
        "error_code" text null,
        "error_message" text null,
        "initiated_at" timestamptz not null,
        "completed_at" timestamptz null,
        "reversed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "payment_transaction_pkey" primary key ("id"),
        constraint "payment_transaction_status_check" check ("status" in ('pending','completed','failed','reversed','refunded')),
        constraint "payment_transaction_payment_type_check" check ("payment_type" in ('stk_push','c2b','manual','cash'))
      );
    `)

    this.addSql(`
      create index if not exists "IDX_payment_transaction_deleted_at"
      on "payment_transaction" ("deleted_at")
      where "deleted_at" is null;
    `)
    this.addSql(`
      create unique index if not exists "idx_payment_transaction_receipt"
      on "payment_transaction" ("mpesa_receipt_number")
      where "mpesa_receipt_number" is not null and "deleted_at" is null;
    `)
    this.addSql(`create index if not exists "idx_payment_transaction_shop" on "payment_transaction" ("shop_id");`)
    this.addSql(`create index if not exists "idx_payment_transaction_order" on "payment_transaction" ("order_id");`)
    this.addSql(`create index if not exists "idx_payment_transaction_transaction_id" on "payment_transaction" ("transaction_id");`)
    this.addSql(`create index if not exists "idx_payment_transaction_status" on "payment_transaction" ("status");`)
    this.addSql(`create index if not exists "idx_payment_transaction_phone" on "payment_transaction" ("phone_number");`)
    this.addSql(`create index if not exists "idx_payment_transaction_created_at" on "payment_transaction" ("created_at");`)
  }
}
