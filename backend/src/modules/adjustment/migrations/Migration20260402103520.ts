import { Migration } from "@mikro-orm/migrations"

export class Migration20260402103520 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "adjustment" add column if not exists "location_id" text null;')
    this.addSql('create index if not exists "idx_adjustment_shop_location_variant" on "adjustment" ("shop_id", "location_id", "variant_id") where deleted_at is null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "idx_adjustment_shop_location_variant";')
    this.addSql('alter table "adjustment" drop column if exists "location_id";')
  }
}
