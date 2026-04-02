import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402171000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "partner" (
        "id" text not null,
        "name" text not null,
        "contact_email" text not null,
        "contact_phone" text null,
        "company_registration" text null,
        "api_key_hash" text not null,
        "api_key_last4" text not null,
        "permissions" jsonb not null,
        "rate_limit" integer not null default 100,
        "quota_monthly" integer not null default 10000,
        "billing_tier" text check ("billing_tier" in ('free', 'basic', 'premium', 'enterprise')) not null default 'free',
        "billing_email" text not null,
        "stripe_customer_id" text null,
        "is_active" boolean not null default true,
        "is_verified" boolean not null default false,
        "approved_by" text null,
        "last_accessed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "partner_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create unique index if not exists "idx_partner_api_key_hash_unique"
      on "partner" ("api_key_hash")
      where "deleted_at" is null;
    `)

    this.addSql(`
      create index if not exists "idx_partner_contact_email"
      on "partner" ("contact_email")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_partner_api_key_hash_unique";`)
    this.addSql(`drop index if exists "idx_partner_contact_email";`)
    this.addSql(`drop table if exists "partner" cascade;`)
  }
}
