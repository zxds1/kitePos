import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403113500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "return_policy" jsonb null,
      add column if not exists "b2b_return_policy" jsonb null,
      add column if not exists "online_return_policy" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "return_policy",
      drop column if exists "b2b_return_policy",
      drop column if exists "online_return_policy";
    `)
  }
}
