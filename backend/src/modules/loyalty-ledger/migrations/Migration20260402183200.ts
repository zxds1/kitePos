import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "loyalty_ledger" (
        "id" text not null,
        "shop_id" text not null,
        "member_id" text not null,
        "entry_type" text check ("entry_type" in ('earn', 'redeem', 'adjust')) not null default 'earn',
        "points_delta" integer not null,
        "reward_name" text null,
        "notes" text null,
        "sale_snapshot_id" text null,
        "created_by" text null,
        "timestamp" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "loyalty_ledger_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_loyalty_ledger_shop_id"
      on "loyalty_ledger" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_ledger_shop_id";`)
    this.addSql(`drop table if exists "loyalty_ledger" cascade;`)
  }
}
