import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401092017 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "restock" add column if not exists "raw_quantity_received" jsonb null, add column if not exists "raw_purchase_unit_qty" jsonb null, add column if not exists "raw_cost_per_unit" jsonb null, add column if not exists "raw_total_cost" jsonb null;`);
    this.addSql(`update "restock" set "raw_quantity_received" = jsonb_build_object('value', "quantity_received"::text, 'precision', 20) where "raw_quantity_received" is null;`);
    this.addSql(`update "restock" set "raw_purchase_unit_qty" = jsonb_build_object('value', "purchase_unit_qty"::text, 'precision', 20) where "raw_purchase_unit_qty" is null;`);
    this.addSql(`update "restock" set "raw_cost_per_unit" = jsonb_build_object('value', "cost_per_unit"::text, 'precision', 20) where "raw_cost_per_unit" is null;`);
    this.addSql(`update "restock" set "raw_total_cost" = jsonb_build_object('value', "total_cost"::text, 'precision', 20) where "raw_total_cost" is null;`);
    this.addSql(`alter table if exists "restock" alter column "quantity_received" type numeric using ("quantity_received"::numeric);`);
    this.addSql(`alter table if exists "restock" alter column "purchase_unit_qty" type numeric using ("purchase_unit_qty"::numeric);`);
    this.addSql(`alter table if exists "restock" alter column "cost_per_unit" type numeric using ("cost_per_unit"::numeric);`);
    this.addSql(`alter table if exists "restock" alter column "total_cost" type numeric using ("total_cost"::numeric);`);
    this.addSql(`alter table if exists "restock" alter column "raw_quantity_received" set not null, alter column "raw_purchase_unit_qty" set not null, alter column "raw_cost_per_unit" set not null, alter column "raw_total_cost" set not null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "restock" drop column if exists "raw_quantity_received", drop column if exists "raw_purchase_unit_qty", drop column if exists "raw_cost_per_unit", drop column if exists "raw_total_cost";`);

    this.addSql(`alter table if exists "restock" alter column "quantity_received" type integer using ("quantity_received"::integer);`);
    this.addSql(`alter table if exists "restock" alter column "purchase_unit_qty" type integer using ("purchase_unit_qty"::integer);`);
    this.addSql(`alter table if exists "restock" alter column "cost_per_unit" type integer using ("cost_per_unit"::integer);`);
    this.addSql(`alter table if exists "restock" alter column "total_cost" type integer using ("total_cost"::integer);`);
  }

}
