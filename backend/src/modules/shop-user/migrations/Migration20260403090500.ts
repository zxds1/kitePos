import { Migration } from "@mikro-orm/migrations"

export class Migration20260403090500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "shop_user" add column if not exists "profile_image_url" text null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "shop_user" drop column if exists "profile_image_url";'
    )
  }
}
