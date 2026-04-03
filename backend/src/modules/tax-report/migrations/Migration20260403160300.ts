import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403160300 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "tax_report" (
        "id" text not null,
        "report_type" text not null,
        "report_period" text not null,
        "shop_id" text not null,
        "report_data" jsonb not null,
        "export_format" text not null default 'json',
        "export_url" text null,
        "kra_submission_ready" boolean not null default false,
        "kra_submission_format" text null,
        "status" text not null default 'generated',
        "generated_at" timestamptz not null,
        "generated_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tax_report_pkey" primary key ("id"),
        constraint "tax_report_report_type_check" check ("report_type" in ('vat_summary', 'sales_day_book', 'purchases_day_book', 'stock_report', 'income_tax_estimate', 'turnover_tax')),
        constraint "tax_report_export_format_check" check ("export_format" in ('pdf', 'excel', 'csv', 'json')),
        constraint "tax_report_status_check" check ("status" in ('generated', 'reviewed', 'submitted', 'archived'))
      );
    `)

    this.addSql(`create index if not exists "idx_tax_report_shop_period" on "tax_report" ("shop_id", "report_period") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_tax_report_shop_period";`)
    this.addSql(`drop table if exists "tax_report" cascade;`)
  }
}
