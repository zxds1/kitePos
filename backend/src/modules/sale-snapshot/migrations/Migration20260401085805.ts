import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401085805 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "sale_snapshot" ("id" text not null, "order_id" text not null, "line_item_id" text not null, "shop_id" text not null, "variant_id" text not null, "inventory_type" text not null, "unit_sold" text not null, "conversion_factor_snapshot" integer not null, "deduction_value" integer not null, "stock_before" integer not null, "stock_after" integer not null, "timestamp" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sale_snapshot_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_sale_snapshot_deleted_at" ON "sale_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sale_snapshot" cascade;`);
  }

}
