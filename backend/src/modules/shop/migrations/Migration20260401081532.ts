import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401081532 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "shop" ("id" text not null, "shop_name" text not null, "owner_phone_hash" text not null, "region_code" text not null, "ward_code" text not null, "consent_given" boolean not null default false, "consent_timestamp" timestamptz null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shop_deleted_at" ON "shop" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shop" cascade;`);
  }

}
