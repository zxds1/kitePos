import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "extraction_source" text null;'
    )
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "extraction_confidence" numeric null;'
    )
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "extraction_raw" text null;'
    )
    this.addSql(
      'alter table "sale_snapshot" add column if not exists "extraction_timestamp" timestamptz null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "extraction_source";'
    )
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "extraction_confidence";'
    )
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "extraction_raw";'
    )
    this.addSql(
      'alter table "sale_snapshot" drop column if exists "extraction_timestamp";'
    )
  }
}
