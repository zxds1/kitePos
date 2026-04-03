import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403160100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "tax_invoice" (
        "id" text not null,
        "invoice_number" text not null,
        "invoice_type" text not null default 'simplified_invoice',
        "shop_id" text not null,
        "sale_id" text null,
        "customer_id" text null,
        "tims_enabled" boolean not null default false,
        "tims_invoice_id" text null,
        "tims_control_unit_serial" text null,
        "tims_react_code" text null,
        "tims_transmission_status" text not null default 'pending',
        "tims_transmitted_at" timestamptz null,
        "tims_accepted_at" timestamptz null,
        "tims_rejection_reason" text null,
        "supplier_kra_pin" text null,
        "supplier_name" text not null,
        "supplier_address" text null,
        "supplier_vat_number" text null,
        "customer_kra_pin" text null,
        "customer_name" text null,
        "customer_address" text null,
        "customer_vat_number" text null,
        "subtotal" numeric not null default 0,
        "discount_amount" numeric not null default 0,
        "taxable_amount" numeric not null default 0,
        "vat_rate" integer not null default 16,
        "vat_amount" numeric not null default 0,
        "withholding_vat_amount" numeric not null default 0,
        "excise_duty_amount" numeric not null default 0,
        "total_amount" numeric not null default 0,
        "vat_breakdown" jsonb null,
        "items" jsonb not null,
        "payment_status" text not null default 'paid',
        "payment_method" text null,
        "payment_date" timestamptz null,
        "invoice_date" timestamptz not null,
        "supply_date" timestamptz not null,
        "due_date" timestamptz null,
        "original_invoice_number" text null,
        "credit_note_reason" text null,
        "qr_code_data" text null,
        "qr_code_image_url" text null,
        "status" text not null default 'issued',
        "cancelled_at" timestamptz null,
        "cancellation_reason" text null,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "tax_invoice_pkey" primary key ("id"),
        constraint "tax_invoice_invoice_type_check" check ("invoice_type" in ('tax_invoice', 'simplified_invoice', 'proforma', 'credit_note', 'debit_note')),
        constraint "tax_invoice_tims_transmission_status_check" check ("tims_transmission_status" in ('pending', 'transmitted', 'accepted', 'rejected')),
        constraint "tax_invoice_payment_status_check" check ("payment_status" in ('paid', 'partial', 'unpaid', 'credit')),
        constraint "tax_invoice_status_check" check ("status" in ('draft', 'issued', 'transmitted', 'accepted', 'cancelled', 'void'))
      );
    `)

    this.addSql(`create unique index if not exists "idx_tax_invoice_number_unique" on "tax_invoice" ("shop_id", "invoice_number") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "idx_tax_invoice_sale_id" on "tax_invoice" ("shop_id", "sale_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "idx_tax_invoice_invoice_date" on "tax_invoice" ("shop_id", "invoice_date") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_tax_invoice_number_unique";`)
    this.addSql(`drop index if exists "idx_tax_invoice_sale_id";`)
    this.addSql(`drop index if exists "idx_tax_invoice_invoice_date";`)
    this.addSql(`drop table if exists "tax_invoice" cascade;`)
  }
}
