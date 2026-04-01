import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401122010 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "sale_snapshot"
      add column if not exists "mpesa_receipt_number" text null,
      add column if not exists "mpesa_customer_phone" text null,
      add column if not exists "amount_paid" numeric not null default 0;
    `)

    this.addSql(`
      update "sale_snapshot"
      set "payment_method" = coalesce(nullif("payment_method", ''), 'cash')
      where "payment_method" is null or "payment_method" = '';
    `)

    this.addSql(`
      alter table if exists "sale_snapshot"
      alter column "payment_method" set default 'cash',
      alter column "payment_method" set not null;
    `)

    this.addSql(`
      update "sale_snapshot"
      set "amount_paid" = coalesce(("raw_price_charged"->>'value')::numeric, "price_charged", 0)
      where "amount_paid" = 0;
    `)

    this.addSql(`
      create index if not exists "idx_sale_snapshot_payment_method"
      on "sale_snapshot" ("payment_method");
    `)

    this.addSql(`
      create index if not exists "idx_sale_snapshot_payment_shop"
      on "sale_snapshot" ("shop_id", "payment_method");
    `)

    this.addSql(`
      create index if not exists "idx_sale_snapshot_payment_date"
      on "sale_snapshot" ("timestamp", "payment_method");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_sale_snapshot_payment_method";`)
    this.addSql(`drop index if exists "idx_sale_snapshot_payment_shop";`)
    this.addSql(`drop index if exists "idx_sale_snapshot_payment_date";`)
    this.addSql(`
      alter table if exists "sale_snapshot"
      alter column "payment_method" drop default,
      alter column "payment_method" drop not null;
    `)
    this.addSql(`
      alter table if exists "sale_snapshot"
      drop column if exists "mpesa_receipt_number",
      drop column if exists "mpesa_customer_phone",
      drop column if exists "amount_paid";
    `)
  }
}
