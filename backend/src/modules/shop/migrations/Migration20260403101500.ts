import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403101500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "is_supplier" boolean not null default false,
      add column if not exists "supplier_verified" boolean not null default false,
      add column if not exists "supplier_categories" jsonb null,
      add column if not exists "supplier_description" text null,
      add column if not exists "years_in_business" integer null,
      add column if not exists "delivery_options" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "is_supplier",
      drop column if exists "supplier_verified",
      drop column if exists "supplier_categories",
      drop column if exists "supplier_description",
      drop column if exists "years_in_business",
      drop column if exists "delivery_options";
    `)
  }
}
