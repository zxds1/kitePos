import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401234000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "analytics_snapshot" (
        "id" text not null,
        "cache_key" text not null,
        "shop_id" text not null,
        "snapshot_type" text check ("snapshot_type" in ('summary', 'product')) not null,
        "variant_id" text null,
        "range_start" timestamptz not null,
        "range_end" timestamptz not null,
        "payload" jsonb not null,
        "computed_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "analytics_snapshot_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create unique index if not exists "idx_analytics_snapshot_cache_key_unique"
      on "analytics_snapshot" ("cache_key")
      where "deleted_at" is null;
    `)

    this.addSql(`
      create index if not exists "IDX_analytics_snapshot_deleted_at"
      on "analytics_snapshot" ("deleted_at")
      where deleted_at is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_analytics_snapshot_cache_key_unique";`)
    this.addSql(`drop index if exists "IDX_analytics_snapshot_deleted_at";`)
    this.addSql(`drop table if exists "analytics_snapshot" cascade;`)
  }
}
