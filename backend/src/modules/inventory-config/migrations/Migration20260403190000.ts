import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "inventory_config"
      add column if not exists "brand" text null,
      add column if not exists "style_code" text null,
      add column if not exists "size" text null,
      add column if not exists "color" text null,
      add column if not exists "gender" text null,
      add column if not exists "material" text null,
      add column if not exists "imei" text null,
      add column if not exists "serial_number" text null,
      add column if not exists "model_name" text null,
      add column if not exists "storage_capacity" text null,
      add column if not exists "device_condition" text not null default 'new',
      add column if not exists "warranty_enabled" boolean not null default false,
      add column if not exists "warranty_months" integer null,
      add column if not exists "is_returnable" boolean not null default true,
      add column if not exists "return_window_days" integer not null default 7;
    `)
    this.addSql(`alter table if exists "inventory_config" drop constraint if exists "inventory_config_gender_check";`)
    this.addSql(`alter table if exists "inventory_config" drop constraint if exists "inventory_config_device_condition_check";`)
    this.addSql(`
      alter table if exists "inventory_config"
      add constraint "inventory_config_gender_check"
      check ("gender" is null or "gender" in ('men', 'women', 'unisex', 'boys', 'girls'));
    `)
    this.addSql(`
      alter table if exists "inventory_config"
      add constraint "inventory_config_device_condition_check"
      check ("device_condition" in ('new', 'refurbished', 'used'));
    `)
    this.addSql(`create index if not exists "idx_inventory_config_imei" on "inventory_config" ("imei") where deleted_at is null and "imei" is not null;`)
    this.addSql(`create index if not exists "idx_inventory_config_brand" on "inventory_config" ("brand") where deleted_at is null;`)
    this.addSql(`create index if not exists "idx_inventory_config_size" on "inventory_config" ("size") where deleted_at is null;`)
    this.addSql(`create index if not exists "idx_inventory_config_color" on "inventory_config" ("color") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_inventory_config_imei";`)
    this.addSql(`drop index if exists "idx_inventory_config_brand";`)
    this.addSql(`drop index if exists "idx_inventory_config_size";`)
    this.addSql(`drop index if exists "idx_inventory_config_color";`)
    this.addSql(`alter table if exists "inventory_config" drop constraint if exists "inventory_config_gender_check";`)
    this.addSql(`alter table if exists "inventory_config" drop constraint if exists "inventory_config_device_condition_check";`)
    this.addSql(`
      alter table if exists "inventory_config"
      drop column if exists "brand",
      drop column if exists "style_code",
      drop column if exists "size",
      drop column if exists "color",
      drop column if exists "gender",
      drop column if exists "material",
      drop column if exists "imei",
      drop column if exists "serial_number",
      drop column if exists "model_name",
      drop column if exists "storage_capacity",
      drop column if exists "device_condition",
      drop column if exists "warranty_enabled",
      drop column if exists "warranty_months",
      drop column if exists "is_returnable",
      drop column if exists "return_window_days";
    `)
  }
}
