import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401093023 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "adjustment" ("id" text not null, "shop_id" text not null, "variant_id" text not null, "adjustment_type" text check ("adjustment_type" in ('correction', 'wastage', 'theft', 'expiry', 'other')) not null, "quantity_change" numeric not null, "reason" text not null, "reference" text null, "before_stock" numeric not null, "after_stock" numeric not null, "evidence_url" text null, "timestamp" timestamptz not null, "raw_quantity_change" jsonb not null, "raw_before_stock" jsonb not null, "raw_after_stock" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "adjustment_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_adjustment_deleted_at" ON "adjustment" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "adjustment" cascade;`);
  }

}
