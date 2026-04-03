import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183400 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "shift_session" (
        "id" text not null,
        "shop_id" text not null,
        "location_id" text null,
        "terminal_id" text null,
        "staff_user_id" text null,
        "opening_cash" numeric not null default 0,
        "expected_cash" numeric not null default 0,
        "counted_cash" numeric null,
        "digital_total" numeric not null default 0,
        "cash_sales_total" numeric not null default 0,
        "total_transactions" integer not null default 0,
        "status" text check ("status" in ('active', 'closed')) not null default 'active',
        "manager_note" text null,
        "opened_at" timestamptz not null,
        "closed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "shift_session_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_shift_session_shop_id"
      on "shift_session" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_shift_session_shop_id";`)
    this.addSql(`drop table if exists "shift_session" cascade;`)
  }
}
