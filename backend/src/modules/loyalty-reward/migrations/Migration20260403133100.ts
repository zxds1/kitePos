import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403133100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "loyalty_reward" (
        "id" text not null,
        "shop_id" text not null,
        "reward_name" text not null,
        "reward_type" text check ("reward_type" in ('discount', 'free_item', 'store_credit', 'mpesa_cashback', 'voucher')) not null default 'discount',
        "points_cost" integer not null,
        "cash_value" numeric not null default 0,
        "reward_variant_id" text null,
        "reward_quantity" integer not null default 1,
        "discount_type" text null,
        "discount_value" numeric null,
        "min_purchase_amount" numeric null,
        "max_redemptions_per_customer" integer null,
        "max_redemptions_total" integer null,
        "valid_from" timestamptz null,
        "valid_until" timestamptz null,
        "is_active" boolean not null default true,
        "redemption_count" integer not null default 0,
        "description" text null,
        "terms_and_conditions" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "loyalty_reward_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_loyalty_reward_shop_id"
      on "loyalty_reward" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_reward_shop_id";`)
    this.addSql(`drop table if exists "loyalty_reward" cascade;`)
  }
}
