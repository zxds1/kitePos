import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "purchase_order" (
        "id" text not null,
        "retailer_shop_id" text not null,
        "supplier_shop_id" text not null,
        "supplier_id" text null,
        "status" text check ("status" in ('pending', 'confirmed', 'dispatched', 'delivered', 'cancelled')) not null default 'pending',
        "items" jsonb not null,
        "subtotal_amount" numeric not null default 0,
        "total_amount" numeric not null default 0,
        "notes" text null,
        "delivery_method" text check ("delivery_method" in ('pickup', 'delivery', 'third_party')) not null default 'delivery',
        "delivery_fee" numeric not null default 0,
        "delivery_status" text check ("delivery_status" in ('pending', 'scheduled', 'in_transit', 'delivered', 'failed')) not null default 'pending',
        "delivery_tracking_info" text null,
        "payment_status" text check ("payment_status" in ('pending', 'paid', 'partial', 'refunded', 'cod')) not null default 'pending',
        "payment_due_date" timestamptz null,
        "mpesa_receipt" text null,
        "auto_reorder_rule_id" text null,
        "cancelled_at" timestamptz null,
        "cancellation_reason" text null,
        "cancelled_by" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "purchase_order_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_purchase_order_retailer"
      on "purchase_order" ("retailer_shop_id")
      where "deleted_at" is null;
    `)
    this.addSql(`
      create index if not exists "idx_purchase_order_supplier"
      on "purchase_order" ("supplier_shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_purchase_order_retailer";`)
    this.addSql(`drop index if exists "idx_purchase_order_supplier";`)
    this.addSql(`drop table if exists "purchase_order" cascade;`)
  }
}
