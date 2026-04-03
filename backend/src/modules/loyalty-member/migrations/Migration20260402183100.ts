import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "loyalty_member" (
        "id" text not null,
        "shop_id" text not null,
        "full_name" text not null,
        "phone_number" text not null,
        "tier" text check ("tier" in ('silver', 'gold', 'platinum')) not null default 'silver',
        "points_balance" integer not null default 0,
        "total_points_earned" integer not null default 0,
        "total_points_redeemed" integer not null default 0,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "loyalty_member_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_loyalty_member_shop_id"
      on "loyalty_member" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_member_shop_id";`)
    this.addSql(`drop table if exists "loyalty_member" cascade;`)
  }
}
