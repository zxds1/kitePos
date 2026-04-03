import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403100500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "auto_reorder_rule" (
        "id" text not null,
        "retailer_shop_id" text not null,
        "supplier_shop_id" text not null,
        "variant_id" text not null,
        "trigger_type" text check ("trigger_type" in ('stock_threshold', 'schedule', 'predictive')) not null default 'stock_threshold',
        "stock_threshold" numeric null,
        "schedule_frequency_days" integer null,
        "last_ordered_at" timestamptz null,
        "order_quantity" numeric not null,
        "preferred_supplier" boolean not null default true,
        "max_price" numeric null,
        "auto_approve" boolean not null default false,
        "budget_limit_monthly" numeric null,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "auto_reorder_rule_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_auto_reorder_rule_retailer"
      on "auto_reorder_rule" ("retailer_shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_auto_reorder_rule_retailer";`)
    this.addSql(`drop table if exists "auto_reorder_rule" cascade;`)
  }
}
