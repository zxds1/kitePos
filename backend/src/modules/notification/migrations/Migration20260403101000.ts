import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403101000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "notification" (
        "id" text not null,
        "shop_id" text not null,
        "user_type" text check ("user_type" in ('retailer', 'supplier', 'admin')) not null default 'retailer',
        "type" text check ("type" in ('new_order', 'order_confirmed', 'order_dispatched', 'order_delivered', 'low_stock', 'reorder_suggestion', 'connection_request', 'price_change')) not null default 'new_order',
        "title" text not null,
        "message" text not null,
        "data" jsonb null,
        "push_sent" boolean not null default false,
        "sms_sent" boolean not null default false,
        "email_sent" boolean not null default false,
        "in_app_read" boolean not null default false,
        "read_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "notification_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      alter table "notification"
      add column if not exists "shop_id" text null,
      add column if not exists "user_type" text not null default 'retailer',
      add column if not exists "type" text not null default 'new_order',
      add column if not exists "title" text not null default 'Notification',
      add column if not exists "message" text not null default '',
      add column if not exists "data" jsonb null,
      add column if not exists "push_sent" boolean not null default false,
      add column if not exists "sms_sent" boolean not null default false,
      add column if not exists "email_sent" boolean not null default false,
      add column if not exists "in_app_read" boolean not null default false,
      add column if not exists "read_at" timestamptz null,
      add column if not exists "created_at" timestamptz not null default now(),
      add column if not exists "updated_at" timestamptz not null default now(),
      add column if not exists "deleted_at" timestamptz null;
    `)
    this.addSql(`
      create index if not exists "idx_notification_shop_id"
      on "notification" ("shop_id", "in_app_read")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_notification_shop_id";`)
    this.addSql(`drop table if exists "notification" cascade;`)
  }
}
