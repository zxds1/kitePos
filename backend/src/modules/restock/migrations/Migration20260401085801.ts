import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401085801 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "restock" ("id" text not null, "shop_id" text not null, "variant_id" text not null, "quantity_received" integer not null, "purchase_unit_qty" integer not null, "cost_per_unit" integer not null, "total_cost" integer not null, "source" text check ("source" in ('manual', 'barcode_scan', 'receipt_scan')) not null, "receipt_image_url" text null, "receipt_raw_text" text null, "supplier_name" text null, "conversion_snapshot" jsonb not null, "timestamp" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "restock_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_restock_deleted_at" ON "restock" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "restock" cascade;`);
  }

}
