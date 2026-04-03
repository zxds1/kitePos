import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403133200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "loyalty_redemption" (
        "id" text not null,
        "member_id" text not null,
        "shop_id" text not null,
        "reward_id" text not null,
        "sale_id" text null,
        "points_redeemed" integer not null,
        "value_received" numeric not null default 0,
        "redemption_type" text check ("redemption_type" in ('discount', 'free_item', 'store_credit', 'mpesa_cashback', 'voucher')) not null default 'discount',
        "status" text check ("status" in ('pending', 'processing', 'completed', 'cancelled', 'expired')) not null default 'pending',
        "mpesa_phone" text null,
        "mpesa_receipt" text null,
        "voucher_code" text null,
        "voucher_used" boolean not null default false,
        "voucher_used_at" timestamptz null,
        "completed_at" timestamptz null,
        "cancelled_at" timestamptz null,
        "redeemed_at" timestamptz not null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "loyalty_redemption_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_loyalty_redemption_member_id"
      on "loyalty_redemption" ("member_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_redemption_member_id";`)
    this.addSql(`drop table if exists "loyalty_redemption" cascade;`)
  }
}
