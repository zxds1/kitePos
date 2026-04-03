import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403161600 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "vat_return"
      add column if not exists "raw_standard_rated_sales" jsonb null,
      add column if not exists "raw_standard_rated_vat" jsonb null,
      add column if not exists "raw_reduced_rated_sales" jsonb null,
      add column if not exists "raw_reduced_rated_vat" jsonb null,
      add column if not exists "raw_zero_rated_sales" jsonb null,
      add column if not exists "raw_exempt_sales" jsonb null,
      add column if not exists "raw_total_output_vat" jsonb null,
      add column if not exists "raw_standard_rated_purchases" jsonb null,
      add column if not exists "raw_standard_rated_input_vat" jsonb null,
      add column if not exists "raw_capital_goods_input_vat" jsonb null,
      add column if not exists "raw_total_input_vat" jsonb null,
      add column if not exists "raw_withholding_vat_suffered" jsonb null,
      add column if not exists "raw_vat_payable" jsonb null,
      add column if not exists "raw_vat_refundable" jsonb null,
      add column if not exists "raw_previous_period_adjustments" jsonb null,
      add column if not exists "raw_other_adjustments" jsonb null,
      add column if not exists "raw_payment_amount" jsonb null;
    `)

    this.addSql(`
      update "vat_return"
      set
        "raw_standard_rated_sales" = coalesce("raw_standard_rated_sales", jsonb_build_object('value', "standard_rated_sales"::text, 'precision', 20)),
        "raw_standard_rated_vat" = coalesce("raw_standard_rated_vat", jsonb_build_object('value', "standard_rated_vat"::text, 'precision', 20)),
        "raw_reduced_rated_sales" = coalesce("raw_reduced_rated_sales", jsonb_build_object('value', "reduced_rated_sales"::text, 'precision', 20)),
        "raw_reduced_rated_vat" = coalesce("raw_reduced_rated_vat", jsonb_build_object('value', "reduced_rated_vat"::text, 'precision', 20)),
        "raw_zero_rated_sales" = coalesce("raw_zero_rated_sales", jsonb_build_object('value', "zero_rated_sales"::text, 'precision', 20)),
        "raw_exempt_sales" = coalesce("raw_exempt_sales", jsonb_build_object('value', "exempt_sales"::text, 'precision', 20)),
        "raw_total_output_vat" = coalesce("raw_total_output_vat", jsonb_build_object('value', "total_output_vat"::text, 'precision', 20)),
        "raw_standard_rated_purchases" = coalesce("raw_standard_rated_purchases", jsonb_build_object('value', "standard_rated_purchases"::text, 'precision', 20)),
        "raw_standard_rated_input_vat" = coalesce("raw_standard_rated_input_vat", jsonb_build_object('value', "standard_rated_input_vat"::text, 'precision', 20)),
        "raw_capital_goods_input_vat" = coalesce("raw_capital_goods_input_vat", jsonb_build_object('value', "capital_goods_input_vat"::text, 'precision', 20)),
        "raw_total_input_vat" = coalesce("raw_total_input_vat", jsonb_build_object('value', "total_input_vat"::text, 'precision', 20)),
        "raw_withholding_vat_suffered" = coalesce("raw_withholding_vat_suffered", jsonb_build_object('value', "withholding_vat_suffered"::text, 'precision', 20)),
        "raw_vat_payable" = coalesce("raw_vat_payable", jsonb_build_object('value', "vat_payable"::text, 'precision', 20)),
        "raw_vat_refundable" = coalesce("raw_vat_refundable", jsonb_build_object('value', "vat_refundable"::text, 'precision', 20)),
        "raw_previous_period_adjustments" = coalesce("raw_previous_period_adjustments", jsonb_build_object('value', "previous_period_adjustments"::text, 'precision', 20)),
        "raw_other_adjustments" = coalesce("raw_other_adjustments", jsonb_build_object('value', "other_adjustments"::text, 'precision', 20)),
        "raw_payment_amount" = coalesce("raw_payment_amount", jsonb_build_object('value', coalesce("payment_amount", 0)::text, 'precision', 20))
      where "deleted_at" is null;
    `)

    this.addSql(`
      alter table if exists "vat_return"
      alter column "raw_standard_rated_sales" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_standard_rated_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_reduced_rated_sales" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_reduced_rated_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_zero_rated_sales" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_exempt_sales" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_total_output_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_standard_rated_purchases" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_standard_rated_input_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_capital_goods_input_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_total_input_vat" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_withholding_vat_suffered" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_vat_payable" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_vat_refundable" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_previous_period_adjustments" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_other_adjustments" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_payment_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_standard_rated_sales" set not null,
      alter column "raw_standard_rated_vat" set not null,
      alter column "raw_reduced_rated_sales" set not null,
      alter column "raw_reduced_rated_vat" set not null,
      alter column "raw_zero_rated_sales" set not null,
      alter column "raw_exempt_sales" set not null,
      alter column "raw_total_output_vat" set not null,
      alter column "raw_standard_rated_purchases" set not null,
      alter column "raw_standard_rated_input_vat" set not null,
      alter column "raw_capital_goods_input_vat" set not null,
      alter column "raw_total_input_vat" set not null,
      alter column "raw_withholding_vat_suffered" set not null,
      alter column "raw_vat_payable" set not null,
      alter column "raw_vat_refundable" set not null,
      alter column "raw_previous_period_adjustments" set not null,
      alter column "raw_other_adjustments" set not null,
      alter column "raw_payment_amount" set not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "vat_return"
      drop column if exists "raw_standard_rated_sales",
      drop column if exists "raw_standard_rated_vat",
      drop column if exists "raw_reduced_rated_sales",
      drop column if exists "raw_reduced_rated_vat",
      drop column if exists "raw_zero_rated_sales",
      drop column if exists "raw_exempt_sales",
      drop column if exists "raw_total_output_vat",
      drop column if exists "raw_standard_rated_purchases",
      drop column if exists "raw_standard_rated_input_vat",
      drop column if exists "raw_capital_goods_input_vat",
      drop column if exists "raw_total_input_vat",
      drop column if exists "raw_withholding_vat_suffered",
      drop column if exists "raw_vat_payable",
      drop column if exists "raw_vat_refundable",
      drop column if exists "raw_previous_period_adjustments",
      drop column if exists "raw_other_adjustments",
      drop column if exists "raw_payment_amount";
    `)
  }
}
