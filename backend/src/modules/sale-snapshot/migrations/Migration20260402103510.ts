import { Migration } from "@mikro-orm/migrations"

export class Migration20260402103510 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "sale_snapshot" add column if not exists "location_id" text null;')
    this.addSql('alter table "sale_snapshot" add column if not exists "sales_channel" text not null default \'pos\';')
    this.addSql('create index if not exists "idx_sale_snapshot_shop_location_variant" on "sale_snapshot" ("shop_id", "location_id", "variant_id") where deleted_at is null;')
    this.addSql('create index if not exists "idx_sale_snapshot_order_line" on "sale_snapshot" ("order_id", "line_item_id") where deleted_at is null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "idx_sale_snapshot_shop_location_variant";')
    this.addSql('drop index if exists "idx_sale_snapshot_order_line";')
    this.addSql('alter table "sale_snapshot" drop column if exists "location_id";')
    this.addSql('alter table "sale_snapshot" drop column if exists "sales_channel";')
  }
}
