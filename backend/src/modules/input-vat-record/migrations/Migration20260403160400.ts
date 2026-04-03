import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403160400 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "input_vat_record" (
        "id" text not null,
        "shop_id" text not null,
        "supplier_shop_id" text null,
        "purchase_order_id" text null,
        "restock_id" text null,
        "supplier_invoice_number" text not null,
        "supplier_invoice_date" timestamptz not null,
        "supplier_kra_pin" text null,
        "supplier_name" text not null,
        "supplier_vat_number" text null,
        "purchase_amount" numeric not null default 0,
        "vat_rate" integer not null default 16,
        "vat_amount" numeric not null default 0,
        "total_amount" numeric not null default 0,
        "vat_claimed" boolean not null default false,
        "vat_claim_period" text null,
        "vat_disallowed" boolean not null default false,
        "disallow_reason" text null,
        "invoice_image_url" text null,
        "invoice_verified" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "input_vat_record_pkey" primary key ("id")
      );
    `)

    this.addSql(`create unique index if not exists "idx_input_vat_restock_unique" on "input_vat_record" ("shop_id", "restock_id") where "restock_id" is not null and "deleted_at" is null;`)
    this.addSql(`create index if not exists "idx_input_vat_period" on "input_vat_record" ("shop_id", "supplier_invoice_date") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_input_vat_restock_unique";`)
    this.addSql(`drop index if exists "idx_input_vat_period";`)
    this.addSql(`drop table if exists "input_vat_record" cascade;`)
  }
}
