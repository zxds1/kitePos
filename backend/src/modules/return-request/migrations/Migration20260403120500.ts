import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403120500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "return_request"
      add column if not exists "raw_amount" jsonb null,
      add column if not exists "raw_total_amount" jsonb null,
      add column if not exists "raw_refund_amount" jsonb null,
      add column if not exists "raw_restocking_fee" jsonb null,
      add column if not exists "raw_return_shipping_cost" jsonb null;
    `)

    this.addSql(`
      update "return_request"
      set
        "raw_amount" = coalesce("raw_amount", jsonb_build_object('value', "amount"::text, 'precision', 20)),
        "raw_total_amount" = coalesce("raw_total_amount", jsonb_build_object('value', "total_amount"::text, 'precision', 20)),
        "raw_refund_amount" = coalesce("raw_refund_amount", jsonb_build_object('value', "refund_amount"::text, 'precision', 20)),
        "raw_restocking_fee" = coalesce("raw_restocking_fee", jsonb_build_object('value', "restocking_fee"::text, 'precision', 20)),
        "raw_return_shipping_cost" = coalesce("raw_return_shipping_cost", jsonb_build_object('value', "return_shipping_cost"::text, 'precision', 20))
      where "deleted_at" is null;
    `)

    this.addSql(`
      alter table if exists "return_request"
      alter column "raw_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_total_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_refund_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_restocking_fee" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_return_shipping_cost" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_amount" set not null,
      alter column "raw_total_amount" set not null,
      alter column "raw_refund_amount" set not null,
      alter column "raw_restocking_fee" set not null,
      alter column "raw_return_shipping_cost" set not null;
    `)

    this.addSql(`
      alter table if exists "return_request"
      drop constraint if exists "return_request_status_check",
      drop constraint if exists "return_request_resolution_check";
    `)

    this.addSql(`
      alter table if exists "return_request"
      add constraint "return_request_status_check"
        check ("status" in ('pending', 'approved', 'denied', 'rejected', 'received', 'inspected', 'refunded', 'completed', 'cancelled')),
      add constraint "return_request_resolution_check"
        check ("resolution" in ('store_credit', 'original_payment', 'exchange', 'bank_transfer', 'cash', 'mpesa'));
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "return_request"
      drop constraint if exists "return_request_status_check",
      drop constraint if exists "return_request_resolution_check";
    `)

    this.addSql(`
      alter table if exists "return_request"
      add constraint "return_request_status_check"
        check ("status" in ('pending', 'approved', 'denied')),
      add constraint "return_request_resolution_check"
        check ("resolution" in ('store_credit', 'original_payment'));
    `)

    this.addSql(`
      alter table if exists "return_request"
      drop column if exists "raw_amount",
      drop column if exists "raw_total_amount",
      drop column if exists "raw_refund_amount",
      drop column if exists "raw_restocking_fee",
      drop column if exists "raw_return_shipping_cost";
    `)
  }
}
