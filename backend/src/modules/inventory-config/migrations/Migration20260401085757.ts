import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401085757 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "inventory_config" ("id" text not null, "variant_id" text not null, "inventory_type" text check ("inventory_type" in ('discrete', 'bulk_loose', 'bulk_liquid', 'multi_pack', 'expiry_tracked')) not null, "purchase_unit" text not null, "purchase_value" integer not null, "selling_units" jsonb not null, "low_stock_threshold" integer not null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "inventory_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_config_deleted_at" ON "inventory_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "inventory_config" cascade;`);
  }

}
