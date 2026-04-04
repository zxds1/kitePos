import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404112000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "online_store" (
        "id" text not null,
        "shop_id" text not null,
        "slug" text not null,
        "subdomain" text not null,
        "public_url" text not null,
        "status" text check ("status" in ('draft', 'generating', 'published', 'failed')) not null default 'draft',
        "theme_name" text not null default 'smart-modern',
        "theme_config" jsonb null,
        "storefront_content" jsonb null,
        "seo_metadata" jsonb null,
        "sharing_metadata" jsonb null,
        "last_generated_at" timestamptz null,
        "generation_error" text null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "online_store_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "idx_online_store_shop_id"
      on "online_store" ("shop_id")
      where "deleted_at" is null;
    `)
    this.addSql(`
      create unique index if not exists "idx_online_store_slug"
      on "online_store" ("slug")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_online_store_shop_id";`)
    this.addSql(`drop index if exists "idx_online_store_slug";`)
    this.addSql(`drop table if exists "online_store" cascade;`)
  }
}
