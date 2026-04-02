import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402151500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "audit_log" (
        "id" text not null,
        "shop_id" text not null,
        "actor_user_id" text null,
        "actor_role" text null,
        "action" text not null,
        "entity_type" text not null,
        "entity_id" text null,
        "location_id" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "audit_log_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create index if not exists "idx_audit_log_shop_created_at"
      on "audit_log" ("shop_id", "created_at")
      where "deleted_at" is null;
    `)

    this.addSql(`
      create index if not exists "IDX_audit_log_deleted_at"
      on "audit_log" ("deleted_at")
      where deleted_at is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_audit_log_shop_created_at";`)
    this.addSql(`drop index if exists "IDX_audit_log_deleted_at";`)
    this.addSql(`drop table if exists "audit_log" cascade;`)
  }
}
