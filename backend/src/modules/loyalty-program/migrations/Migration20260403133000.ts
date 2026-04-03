import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403133000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "loyalty_program" (
        "id" text not null,
        "shop_id" text not null,
        "program_name" text not null default 'UZA Rewards',
        "program_type" text check ("program_type" in ('points', 'tier', 'cashback', 'stamp', 'hybrid')) not null default 'hybrid',
        "earn_rate" numeric not null default 1,
        "earn_rate_multiplier_weekend" numeric not null default 1,
        "earn_rate_multiplier_special" numeric not null default 1,
        "points_value" numeric not null default 0.01,
        "min_redemption_points" integer not null default 100,
        "max_discount_percent" numeric not null default 20,
        "points_expire" boolean not null default false,
        "expiry_days" integer not null default 365,
        "has_tiers" boolean not null default true,
        "tiers" jsonb null,
        "stamp_target" integer not null default 10,
        "stamp_reward" text null,
        "cashback_percent" numeric not null default 2,
        "cashback_method" text check ("cashback_method" in ('store_credit', 'mpesa')) not null default 'store_credit',
        "cashback_min_purchase" numeric not null default 500,
        "referral_bonus_points" integer not null default 100,
        "referral_signup_bonus" integer not null default 50,
        "auto_enroll" boolean not null default true,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "loyalty_program_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_loyalty_program_shop_id"
      on "loyalty_program" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_program_shop_id";`)
    this.addSql(`drop table if exists "loyalty_program" cascade;`)
  }
}
