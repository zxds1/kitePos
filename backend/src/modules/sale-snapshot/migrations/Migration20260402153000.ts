import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402153000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "sale_snapshot" add column if not exists "terminal_id" text null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table "sale_snapshot" drop column if exists "terminal_id";')
  }
}
