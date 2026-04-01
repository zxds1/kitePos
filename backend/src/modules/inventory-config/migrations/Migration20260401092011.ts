import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401092011 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "inventory_config" add column if not exists "raw_purchase_value" jsonb null, add column if not exists "raw_low_stock_threshold" jsonb null;`);
    this.addSql(`update "inventory_config" set "raw_purchase_value" = jsonb_build_object('value', "purchase_value"::text, 'precision', 20) where "raw_purchase_value" is null;`);
    this.addSql(`update "inventory_config" set "raw_low_stock_threshold" = jsonb_build_object('value', "low_stock_threshold"::text, 'precision', 20) where "raw_low_stock_threshold" is null;`);
    this.addSql(`alter table if exists "inventory_config" alter column "purchase_value" type numeric using ("purchase_value"::numeric);`);
    this.addSql(`alter table if exists "inventory_config" alter column "low_stock_threshold" type numeric using ("low_stock_threshold"::numeric);`);
    this.addSql(`alter table if exists "inventory_config" alter column "raw_purchase_value" set not null, alter column "raw_low_stock_threshold" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "inventory_config" drop column if exists "raw_purchase_value", drop column if exists "raw_low_stock_threshold";`);

    this.addSql(`alter table if exists "inventory_config" alter column "purchase_value" type integer using ("purchase_value"::integer);`);
    this.addSql(`alter table if exists "inventory_config" alter column "low_stock_threshold" type integer using ("low_stock_threshold"::integer);`);
  }

}
