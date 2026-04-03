import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403161700 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "input_vat_record"
      add column if not exists "raw_purchase_amount" jsonb null,
      add column if not exists "raw_vat_amount" jsonb null,
      add column if not exists "raw_total_amount" jsonb null;
    `)

    this.addSql(`
      update "input_vat_record"
      set
        "raw_purchase_amount" = coalesce("raw_purchase_amount", jsonb_build_object('value', "purchase_amount"::text, 'precision', 20)),
        "raw_vat_amount" = coalesce("raw_vat_amount", jsonb_build_object('value', "vat_amount"::text, 'precision', 20)),
        "raw_total_amount" = coalesce("raw_total_amount", jsonb_build_object('value', "total_amount"::text, 'precision', 20))
      where "deleted_at" is null;
    `)

    this.addSql(`
      alter table if exists "input_vat_record"
      alter column "raw_purchase_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_vat_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_total_amount" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_purchase_amount" set not null,
      alter column "raw_vat_amount" set not null,
      alter column "raw_total_amount" set not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "input_vat_record"
      drop column if exists "raw_purchase_amount",
      drop column if exists "raw_vat_amount",
      drop column if exists "raw_total_amount";
    `)
  }
}
