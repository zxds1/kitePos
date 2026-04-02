import { Migration } from "@mikro-orm/migrations"

export class Migration20260402103500 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "restock" add column if not exists "location_id" text null;')
    this.addSql('alter table "restock" add column if not exists "sales_channel" text not null default \'pos\';')
    this.addSql('create index if not exists "idx_restock_shop_location_variant" on "restock" ("shop_id", "location_id", "variant_id") where deleted_at is null;')
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "idx_restock_shop_location_variant";')
    this.addSql('alter table "restock" drop column if exists "location_id";')
    this.addSql('alter table "restock" drop column if exists "sales_channel";')
  }
}
