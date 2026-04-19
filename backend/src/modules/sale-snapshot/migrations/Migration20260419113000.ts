import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260419113000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "source_image_url" text null;'
    )
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "source_file_name" text null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "source_image_url";'
    )
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "source_file_name";'
    )
  }
}
