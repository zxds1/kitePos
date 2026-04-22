import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260422110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "custom_industry_label" text null,
      add column if not exists "shop_categories" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "shop_categories",
      drop column if exists "custom_industry_label";
    `)
  }
}
