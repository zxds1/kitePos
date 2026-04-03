import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "supplier" (
        "id" text not null,
        "shop_id" text not null,
        "name" text not null,
        "category" text not null default 'general',
        "contact_email" text null,
        "contact_phone" text null,
        "billing_tier" text check ("billing_tier" in ('standard', 'premium', 'strategic')) not null default 'standard',
        "lead_time_days" integer not null default 3,
        "notes" text null,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "supplier_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_supplier_shop_id"
      on "supplier" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_supplier_shop_id";`)
    this.addSql(`drop table if exists "supplier" cascade;`)
  }
}
