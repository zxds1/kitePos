import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402083000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "owner_name" text null,
      add column if not exists "address" text null,
      add column if not exists "business_license" text null,
      add column if not exists "consent_version" text null,
      add column if not exists "data_sharing_consent" boolean not null default false,
      add column if not exists "analytics_consent" boolean not null default false;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "owner_name",
      drop column if exists "address",
      drop column if exists "business_license",
      drop column if exists "consent_version",
      drop column if exists "data_sharing_consent",
      drop column if exists "analytics_consent";
    `)
  }
}
