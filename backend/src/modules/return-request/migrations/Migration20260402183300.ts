import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "return_request" (
        "id" text not null,
        "shop_id" text not null,
        "order_reference" text null,
        "sale_snapshot_id" text null,
        "customer_name" text null,
        "item_name" text not null,
        "reason" text not null,
        "amount" numeric not null default 0,
        "status" text check ("status" in ('pending', 'approved', 'denied')) not null default 'pending',
        "resolution" text check ("resolution" in ('store_credit', 'original_payment')) not null default 'store_credit',
        "notes" text null,
        "created_by" text null,
        "decided_by" text null,
        "decided_at" timestamptz null,
        "requested_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "return_request_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_return_request_shop_id"
      on "return_request" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_return_request_shop_id";`)
    this.addSql(`drop table if exists "return_request" cascade;`)
  }
}
