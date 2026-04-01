import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "shop" add column if not exists "category" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "shop" drop column if exists "category";`)
  }
}
