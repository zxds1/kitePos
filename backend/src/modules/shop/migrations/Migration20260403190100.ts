import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403190100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "shop_type" text not null default 'retail_duka',
      add column if not exists "industry_features" jsonb null;
    `)
    this.addSql(`alter table if exists "shop" drop constraint if exists "shop_shop_type_check";`)
    this.addSql(`
      alter table if exists "shop"
      add constraint "shop_shop_type_check"
      check ("shop_type" in (
        'retail_duka',
        'wholesale_supplier',
        'fashion_retail',
        'fashion_vendor',
        'electronics_retail',
        'electronics_vendor',
        'electronics_repair',
        'fashion_tailoring',
        'cereals_store'
      ));
    `)
    this.addSql(`create index if not exists "idx_shop_shop_type" on "shop" ("shop_type");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_shop_shop_type";`)
    this.addSql(`alter table if exists "shop" drop constraint if exists "shop_shop_type_check";`)
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "shop_type",
      drop column if exists "industry_features";
    `)
  }
}
