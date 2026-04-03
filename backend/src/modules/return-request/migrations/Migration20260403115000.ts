import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403115000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "return_request"
      add column if not exists "supplier_shop_id" text null,
      add column if not exists "customer_id" text null,
      add column if not exists "original_sale_id" text null,
      add column if not exists "original_order_id" text null,
      add column if not exists "return_number" text null,
      add column if not exists "return_type" text not null default 'manual',
      add column if not exists "items" jsonb null,
      add column if not exists "return_reason" text null,
      add column if not exists "return_reason_category" text not null default 'other',
      add column if not exists "item_condition" text not null default 'new',
      add column if not exists "total_amount" numeric not null default 0,
      add column if not exists "refund_amount" numeric not null default 0,
      add column if not exists "restocking_fee" numeric not null default 0,
      add column if not exists "return_method" text not null default 'drop_off',
      add column if not exists "return_shipping_cost" numeric not null default 0,
      add column if not exists "shipping_paid_by" text not null default 'seller',
      add column if not exists "tracking_number" text null,
      add column if not exists "customer_notes" text null,
      add column if not exists "approved_by" text null,
      add column if not exists "approved_at" timestamptz null,
      add column if not exists "rejected_at" timestamptz null,
      add column if not exists "rejection_reason" text null,
      add column if not exists "received_at" timestamptz null,
      add column if not exists "received_by" text null,
      add column if not exists "refund_status" text not null default 'pending',
      add column if not exists "refund_transaction_id" text null,
      add column if not exists "refunded_at" timestamptz null,
      add column if not exists "fraud_score" numeric not null default 0,
      add column if not exists "fraud_flags" jsonb null;
    `)
    this.addSql(`
      update "return_request"
      set
        "return_number" = coalesce("return_number", 'RET-' || replace(substr(md5("id"), 1, 10), '-', '')),
        "return_reason" = coalesce("return_reason", "reason"),
        "total_amount" = coalesce("total_amount", "amount"),
        "refund_amount" = coalesce("refund_amount", "amount")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "return_request"
      drop column if exists "supplier_shop_id",
      drop column if exists "customer_id",
      drop column if exists "original_sale_id",
      drop column if exists "original_order_id",
      drop column if exists "return_number",
      drop column if exists "return_type",
      drop column if exists "items",
      drop column if exists "return_reason",
      drop column if exists "return_reason_category",
      drop column if exists "item_condition",
      drop column if exists "total_amount",
      drop column if exists "refund_amount",
      drop column if exists "restocking_fee",
      drop column if exists "return_method",
      drop column if exists "return_shipping_cost",
      drop column if exists "shipping_paid_by",
      drop column if exists "tracking_number",
      drop column if exists "customer_notes",
      drop column if exists "approved_by",
      drop column if exists "approved_at",
      drop column if exists "rejected_at",
      drop column if exists "rejection_reason",
      drop column if exists "received_at",
      drop column if exists "received_by",
      drop column if exists "refund_status",
      drop column if exists "refund_transaction_id",
      drop column if exists "refunded_at",
      drop column if exists "fraud_score",
      drop column if exists "fraud_flags";
    `)
  }
}
