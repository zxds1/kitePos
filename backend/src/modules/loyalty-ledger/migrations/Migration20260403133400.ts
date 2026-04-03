import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403133400 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "loyalty_ledger" drop constraint if exists "loyalty_ledger_entry_type_check";`)
    this.addSql(`
      alter table "loyalty_ledger"
      add constraint "loyalty_ledger_entry_type_check"
      check ("entry_type" in ('earn', 'redeem', 'adjust', 'referral_bonus', 'signup_bonus', 'birthday_bonus', 'promotional', 'expire', 'return_reversal', 'cashback'));
    `)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "points_balance_after" integer null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "reward_id" text null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "redemption_id" text null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "return_request_id" text null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "purchase_amount" numeric null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "earn_rate_applied" numeric null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "redemption_type" text null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "redemption_value" numeric null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "expires_at" timestamptz null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "expired_at" timestamptz null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "fraud_flag" boolean not null default false;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "fraud_reason" text null;`)
    this.addSql(`alter table "loyalty_ledger" add column if not exists "sale_id" text null;`)
    this.addSql(`create index if not exists "idx_loyalty_ledger_member_id" on "loyalty_ledger" ("member_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "idx_loyalty_ledger_sale_snapshot_id" on "loyalty_ledger" ("sale_snapshot_id") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_loyalty_ledger_member_id";`)
    this.addSql(`drop index if exists "idx_loyalty_ledger_sale_snapshot_id";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "points_balance_after";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "reward_id";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "redemption_id";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "return_request_id";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "purchase_amount";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "earn_rate_applied";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "redemption_type";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "redemption_value";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "expires_at";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "expired_at";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "fraud_flag";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "fraud_reason";`)
    this.addSql(`alter table "loyalty_ledger" drop column if exists "sale_id";`)
    this.addSql(`alter table "loyalty_ledger" drop constraint if exists "loyalty_ledger_entry_type_check";`)
    this.addSql(`
      alter table "loyalty_ledger"
      add constraint "loyalty_ledger_entry_type_check"
      check ("entry_type" in ('earn', 'redeem', 'adjust'));
    `)
  }
}
