import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403114500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "return_reason_catalog" (
        "id" text not null,
        "reason_code" text not null,
        "reason_label" text not null,
        "reason_category" text check ("reason_category" in ('defective', 'expired', 'wrong_item', 'damaged', 'overstock', 'customer_change', 'other')) not null default 'other',
        "description" text null,
        "is_active" boolean not null default true,
        "requires_photo" boolean not null default false,
        "auto_approve" boolean not null default false,
        "restocking_fee_percent" numeric not null default 0,
        "applies_to_b2c" boolean not null default true,
        "applies_to_b2b" boolean not null default true,
        "applies_to_online" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "return_reason_catalog_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_return_reason_catalog_code"
      on "return_reason_catalog" ("reason_code")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_return_reason_catalog_code";`)
    this.addSql(`drop table if exists "return_reason_catalog" cascade;`)
  }
}
