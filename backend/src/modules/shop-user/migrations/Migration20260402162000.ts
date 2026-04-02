import { Migration } from "@mikro-orm/migrations"

export class Migration20260402162000 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "shop_user" add column if not exists "must_change_pin" boolean not null default false;')
    this.addSql('alter table "shop_user" add column if not exists "device_hash" text null;')
    this.addSql('alter table "shop_user" add column if not exists "invite_code_hash" text null;')
    this.addSql('alter table "shop_user" add column if not exists "invite_expires_at" timestamptz null;')
    this.addSql('alter table "shop_user" add column if not exists "recovery_code_hash" text null;')
    this.addSql('alter table "shop_user" add column if not exists "recovery_expires_at" timestamptz null;')
  }

  override async down(): Promise<void> {
    this.addSql('alter table "shop_user" drop column if exists "must_change_pin";')
    this.addSql('alter table "shop_user" drop column if exists "device_hash";')
    this.addSql('alter table "shop_user" drop column if exists "invite_code_hash";')
    this.addSql('alter table "shop_user" drop column if exists "invite_expires_at";')
    this.addSql('alter table "shop_user" drop column if exists "recovery_code_hash";')
    this.addSql('alter table "shop_user" drop column if exists "recovery_expires_at";')
  }
}
