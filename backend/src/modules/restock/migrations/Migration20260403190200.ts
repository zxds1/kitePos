import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403190200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "restock"
      add column if not exists "size" text null,
      add column if not exists "color" text null,
      add column if not exists "imei_list" jsonb null,
      add column if not exists "model_name" text null;
    `)
    this.addSql(`create index if not exists "idx_restock_size" on "restock" ("size") where deleted_at is null;`)
    this.addSql(`create index if not exists "idx_restock_color" on "restock" ("color") where deleted_at is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_restock_size";`)
    this.addSql(`drop index if exists "idx_restock_color";`)
    this.addSql(`
      alter table if exists "restock"
      drop column if exists "size",
      drop column if exists "color",
      drop column if exists "imei_list",
      drop column if exists "model_name";
    `)
  }
}
