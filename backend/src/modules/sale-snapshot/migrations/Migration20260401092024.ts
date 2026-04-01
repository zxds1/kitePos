import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401092024 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "sale_snapshot" add column if not exists "raw_conversion_factor_snapshot" jsonb null, add column if not exists "raw_deduction_value" jsonb null, add column if not exists "raw_stock_before" jsonb null, add column if not exists "raw_stock_after" jsonb null;`);
    this.addSql(`update "sale_snapshot" set "raw_conversion_factor_snapshot" = jsonb_build_object('value', "conversion_factor_snapshot"::text, 'precision', 20) where "raw_conversion_factor_snapshot" is null;`);
    this.addSql(`update "sale_snapshot" set "raw_deduction_value" = jsonb_build_object('value', "deduction_value"::text, 'precision', 20) where "raw_deduction_value" is null;`);
    this.addSql(`update "sale_snapshot" set "raw_stock_before" = jsonb_build_object('value', "stock_before"::text, 'precision', 20) where "raw_stock_before" is null;`);
    this.addSql(`update "sale_snapshot" set "raw_stock_after" = jsonb_build_object('value', "stock_after"::text, 'precision', 20) where "raw_stock_after" is null;`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "conversion_factor_snapshot" type numeric using ("conversion_factor_snapshot"::numeric);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "deduction_value" type numeric using ("deduction_value"::numeric);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "stock_before" type numeric using ("stock_before"::numeric);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "stock_after" type numeric using ("stock_after"::numeric);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "raw_conversion_factor_snapshot" set not null, alter column "raw_deduction_value" set not null, alter column "raw_stock_before" set not null, alter column "raw_stock_after" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "sale_snapshot" drop column if exists "raw_conversion_factor_snapshot", drop column if exists "raw_deduction_value", drop column if exists "raw_stock_before", drop column if exists "raw_stock_after";`);

    this.addSql(`alter table if exists "sale_snapshot" alter column "conversion_factor_snapshot" type integer using ("conversion_factor_snapshot"::integer);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "deduction_value" type integer using ("deduction_value"::integer);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "stock_before" type integer using ("stock_before"::integer);`);
    this.addSql(`alter table if exists "sale_snapshot" alter column "stock_after" type integer using ("stock_after"::integer);`);
  }

}
