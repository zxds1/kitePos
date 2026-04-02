import { Migration } from "@mikro-orm/migrations"

export class Migration20260402103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table if not exists "shop_location" ("id" text not null, "shop_id" text not null, "name" text not null, "code" text not null, "address" text null, "location_type" text check ("location_type" in (\'physical\', \'online\', \'shared\')) not null default \'physical\', "is_default" boolean not null default true, "is_active" boolean not null default true, "stock_location_id" text null, "sales_channel_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_location_pkey" primary key ("id"));'
    )
    this.addSql(
      'create index if not exists "idx_shop_location_shop_default" on "shop_location" ("shop_id", "is_default") where deleted_at is null;'
    )
    this.addSql(
      'create index if not exists "idx_shop_location_shop_active" on "shop_location" ("shop_id", "is_active") where deleted_at is null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "shop_location" cascade;')
  }
}
