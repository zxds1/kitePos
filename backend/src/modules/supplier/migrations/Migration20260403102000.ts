import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403102000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "supplier"
      add column if not exists "supplier_shop_id" text null,
      add column if not exists "delivery_options" jsonb null,
      add column if not exists "accepts_auto_reorder" boolean not null default false,
      add column if not exists "preferred" boolean not null default false;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "supplier"
      drop column if exists "supplier_shop_id",
      drop column if exists "delivery_options",
      drop column if exists "accepts_auto_reorder",
      drop column if exists "preferred";
    `)
  }
}
