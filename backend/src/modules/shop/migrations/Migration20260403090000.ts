import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "profile_image_url" text null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "profile_image_url";
    `)
  }
}
