import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403161500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "tax_invoice"
      add column if not exists "raw_subtotal" jsonb null,
      add column if not exists "raw_discount_amount" jsonb null,
      add column if not exists "raw_taxable_amount" jsonb null,
      add column if not exists "raw_vat_amount" jsonb null,
      add column if not exists "raw_withholding_vat_amount" jsonb null,
      add column if not exists "raw_excise_duty_amount" jsonb null,
      add column if not exists "raw_total_amount" jsonb null;
    `)

    this.addSql(`
      update "tax_invoice"
      set
        "raw_subtotal" = coalesce("raw_subtotal", jsonb_build_object('value', "subtotal"::text, 'precision', 20)),
        "raw_discount_amount" = coalesce("raw_discount_amount", jsonb_build_object('value', "discount_amount"::text, 'precision', 20)),
        "raw_taxable_amount" = coalesce("raw_taxable_amount", jsonb_build_object('value', "taxable_amount"::text, 'precision', 20)),
        "raw_vat_amount" = coalesce("raw_vat_amount", jsonb_build_object('value', "vat_amount"::text, 'precision', 20)),
        "raw_withholding_vat_amount" = coalesce("raw_withholding_vat_amount", jsonb_build_object('value', "withholding_vat_amount"::text, 'precision', 20)),
        "raw_excise_duty_amount" = coalesce("raw_excise_duty_amount", jsonb_build_object('value', "excise_duty_amount"::text, 'precision', 20)),
        "raw_total_amount" = coalesce("raw_total_amount", jsonb_build_object('value', "total_amount"::text, 'precision', 20))
      where "deleted_at" is null;
    `)

    this.addSql(`
      alter table if exists "tax_invoice"
      alter column "raw_subtotal" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_discount_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_taxable_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_vat_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_withholding_vat_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_excise_duty_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_total_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_subtotal" set not null,
      alter column "raw_discount_amount" set not null,
      alter column "raw_taxable_amount" set not null,
      alter column "raw_vat_amount" set not null,
      alter column "raw_withholding_vat_amount" set not null,
      alter column "raw_excise_duty_amount" set not null,
      alter column "raw_total_amount" set not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "tax_invoice"
      drop column if exists "raw_subtotal",
      drop column if exists "raw_discount_amount",
      drop column if exists "raw_taxable_amount",
      drop column if exists "raw_vat_amount",
      drop column if exists "raw_withholding_vat_amount",
      drop column if exists "raw_excise_duty_amount",
      drop column if exists "raw_total_amount";
    `)
  }
}
