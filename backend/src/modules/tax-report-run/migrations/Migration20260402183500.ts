import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402183500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "tax_report_run" (
        "id" text not null,
        "shop_id" text not null,
        "report_type" text check ("report_type" in ('vat', 'income', 'paye')) not null default 'vat',
        "branch_scope" text null,
        "period_start" timestamptz not null,
        "period_end" timestamptz not null,
        "vat_rate_percent" integer not null default 16,
        "status" text check ("status" in ('completed')) not null default 'completed',
        "payload" jsonb not null,
        "generated_by" text null,
        "generated_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tax_report_run_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_tax_report_run_shop_id"
      on "tax_report_run" ("shop_id")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_tax_report_run_shop_id";`)
    this.addSql(`drop table if exists "tax_report_run" cascade;`)
  }
}
