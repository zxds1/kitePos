import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "kra_pin" text null,
      add column if not exists "vat_registered" boolean not null default false,
      add column if not exists "vat_registration_number" text null,
      add column if not exists "tax_type" text not null default 'exempt',
      add column if not exists "turnover_threshold" integer not null default 0,
      add column if not exists "tims_enabled" boolean not null default false,
      add column if not exists "tims_device_id" text null,
      add column if not exists "etr_serial_number" text null,
      add column if not exists "invoice_prefix" text not null default 'INV',
      add column if not exists "invoice_number_sequence" integer not null default 1,
      add column if not exists "tax_invoice_enabled" boolean not null default false,
      add column if not exists "whvat_applicable" boolean not null default false,
      add column if not exists "whvat_registration" text null,
      add column if not exists "tax_reporting_email" text null,
      add column if not exists "last_vat_return_filed" timestamptz null,
      add column if not exists "last_vat_return_period" text null;
    `)

    this.addSql(`alter table if exists "shop" drop constraint if exists "shop_tax_type_check";`)
    this.addSql(`
      alter table if exists "shop"
      add constraint "shop_tax_type_check"
      check ("tax_type" in ('vat', 'turnover_tax', 'exempt'));
    `)

    this.addSql(`create index if not exists "idx_shop_tax_type" on "shop" ("tax_type");`)
    this.addSql(`create index if not exists "idx_shop_tims_enabled" on "shop" ("tims_enabled");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_shop_tax_type";`)
    this.addSql(`drop index if exists "idx_shop_tims_enabled";`)
    this.addSql(`alter table if exists "shop" drop constraint if exists "shop_tax_type_check";`)
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "kra_pin",
      drop column if exists "vat_registered",
      drop column if exists "vat_registration_number",
      drop column if exists "tax_type",
      drop column if exists "turnover_threshold",
      drop column if exists "tims_enabled",
      drop column if exists "tims_device_id",
      drop column if exists "etr_serial_number",
      drop column if exists "invoice_prefix",
      drop column if exists "invoice_number_sequence",
      drop column if exists "tax_invoice_enabled",
      drop column if exists "whvat_applicable",
      drop column if exists "whvat_registration",
      drop column if exists "tax_reporting_email",
      drop column if exists "last_vat_return_filed",
      drop column if exists "last_vat_return_period";
    `)
  }
}
