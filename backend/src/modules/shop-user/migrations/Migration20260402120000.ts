import { Migration } from "@mikro-orm/migrations"

export class Migration20260402120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table if not exists "shop_user" ("id" text not null, "shop_id" text not null, "phone_hash" text not null, "full_name" text null, "role" text check ("role" in (\'owner\', \'admin\', \'branch_manager\', \'cashier\')) not null default \'cashier\', "assigned_location_ids" jsonb null, "is_active" boolean not null default true, "last_login_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_user_pkey" primary key ("id"));'
    )
    this.addSql(
      'create index if not exists "idx_shop_user_phone" on "shop_user" ("phone_hash") where deleted_at is null;'
    )
    this.addSql(
      'create index if not exists "idx_shop_user_shop_role" on "shop_user" ("shop_id", "role") where deleted_at is null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists "shop_user" cascade;')
  }
}
