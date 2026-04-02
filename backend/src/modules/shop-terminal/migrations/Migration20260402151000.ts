import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402151000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "shop_terminal" (
        "id" text not null,
        "shop_id" text not null,
        "location_id" text not null,
        "name" text not null,
        "code" text not null,
        "assigned_user_id" text null,
        "is_active" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "shop_terminal_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create unique index if not exists "idx_shop_terminal_shop_code_unique"
      on "shop_terminal" ("shop_id", "code")
      where "deleted_at" is null;
    `)

    this.addSql(`
      create index if not exists "IDX_shop_terminal_deleted_at"
      on "shop_terminal" ("deleted_at")
      where deleted_at is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_shop_terminal_shop_code_unique";`)
    this.addSql(`drop index if exists "IDX_shop_terminal_deleted_at";`)
    this.addSql(`drop table if exists "shop_terminal" cascade;`)
  }
}
