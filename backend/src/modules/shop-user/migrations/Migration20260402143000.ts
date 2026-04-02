import { Migration } from "@mikro-orm/migrations"

export class Migration20260402143000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "shop_user" add column if not exists "pin_hash" text null;'
    )
    this.addSql(
      'alter table "shop_user" add column if not exists "pin_updated_at" timestamptz null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql('alter table "shop_user" drop column if exists "pin_hash";')
    this.addSql('alter table "shop_user" drop column if exists "pin_updated_at";')
  }
}
