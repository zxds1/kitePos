import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403160200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "vat_return" (
        "id" text not null,
        "return_period" text not null,
        "shop_id" text not null,
        "kra_pin" text null,
        "standard_rated_sales" numeric not null default 0,
        "standard_rated_vat" numeric not null default 0,
        "reduced_rated_sales" numeric not null default 0,
        "reduced_rated_vat" numeric not null default 0,
        "zero_rated_sales" numeric not null default 0,
        "exempt_sales" numeric not null default 0,
        "total_output_vat" numeric not null default 0,
        "standard_rated_purchases" numeric not null default 0,
        "standard_rated_input_vat" numeric not null default 0,
        "capital_goods_input_vat" numeric not null default 0,
        "total_input_vat" numeric not null default 0,
        "withholding_vat_suffered" numeric not null default 0,
        "withholding_vat_certificate" text null,
        "vat_payable" numeric not null default 0,
        "vat_refundable" numeric not null default 0,
        "previous_period_adjustments" numeric not null default 0,
        "other_adjustments" numeric not null default 0,
        "adjustments_description" text null,
        "filed_via" text not null default 'manual',
        "itimis_acknowledgement" text null,
        "filed_at" timestamptz null,
        "filed_by" text null,
        "payment_status" text not null default 'pending',
        "payment_reference" text null,
        "payment_date" timestamptz null,
        "payment_amount" numeric null,
        "status" text not null default 'draft',
        "rejection_reason" text null,
        "amended_return_id" text null,
        "supporting_documents" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "vat_return_pkey" primary key ("id"),
        constraint "vat_return_filed_via_check" check ("filed_via" in ('manual', 'itimis', 'api')),
        constraint "vat_return_payment_status_check" check ("payment_status" in ('pending', 'paid', 'partial', 'refund_due')),
        constraint "vat_return_status_check" check ("status" in ('draft', 'filed', 'accepted', 'rejected', 'amended'))
      );
    `)

    this.addSql(`create unique index if not exists "idx_vat_return_shop_period_unique" on "vat_return" ("shop_id", "return_period") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "idx_vat_return_status" on "vat_return" ("shop_id", "status") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_vat_return_shop_period_unique";`)
    this.addSql(`drop index if exists "idx_vat_return_status";`)
    this.addSql(`drop table if exists "vat_return" cascade;`)
  }
}
