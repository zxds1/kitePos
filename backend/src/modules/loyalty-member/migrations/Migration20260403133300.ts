import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403133300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "loyalty_member" add column if not exists "phone_number_hash" text null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "date_of_birth" text null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "referred_by_phone" text null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "current_tier" text not null default 'silver';`)
    this.addSql(`alter table "loyalty_member" add column if not exists "next_tier" text null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "points_to_next_tier" integer null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "tier_progress_points" integer not null default 0;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "stamps_collected" integer not null default 0;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "stamps_redeemed" integer not null default 0;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "referrals_count" integer not null default 0;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "points_pending" integer not null default 0;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "opted_out" boolean not null default false;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "opted_out_at" timestamptz null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "enrolled_at" timestamptz null;`)
    this.addSql(`alter table "loyalty_member" add column if not exists "last_activity_at" timestamptz null;`)
    this.addSql(`update "loyalty_member" set "phone_number_hash" = coalesce("phone_number_hash", md5("phone_number"));`)
    this.addSql(`update "loyalty_member" set "current_tier" = lower(coalesce("current_tier", "tier", 'silver'));`)
    this.addSql(`update "loyalty_member" set "enrolled_at" = coalesce("enrolled_at", "created_at"), "last_activity_at" = coalesce("last_activity_at", "updated_at");`)
    this.addSql(`create index if not exists "idx_loyalty_member_shop_phone_hash" on "loyalty_member" ("shop_id", "phone_number_hash") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_member_shop_phone_hash";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "phone_number_hash";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "date_of_birth";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "referred_by_phone";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "current_tier";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "next_tier";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "points_to_next_tier";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "tier_progress_points";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "stamps_collected";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "stamps_redeemed";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "referrals_count";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "points_pending";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "opted_out";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "opted_out_at";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "enrolled_at";`)
    this.addSql(`alter table "loyalty_member" drop column if exists "last_activity_at";`)
  }
}
