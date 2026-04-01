import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401122000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "mpesa_phone" text null,
      add column if not exists "mpesa_till" text null,
      add column if not exists "mpesa_paybill" text null,
      add column if not exists "accept_mpesa" boolean not null default true,
      add column if not exists "mpesa_display_name" text null;
    `)

    this.addSql(`
      create index if not exists "idx_shop_accept_mpesa"
      on "shop" ("accept_mpesa");
    `)

    this.addSql(`
      create index if not exists "idx_shop_region_mpesa"
      on "shop" ("region_code", "accept_mpesa");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_shop_accept_mpesa";`)
    this.addSql(`drop index if exists "idx_shop_region_mpesa";`)
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "mpesa_phone",
      drop column if exists "mpesa_till",
      drop column if exists "mpesa_paybill",
      drop column if exists "accept_mpesa",
      drop column if exists "mpesa_display_name";
    `)
  }
}
