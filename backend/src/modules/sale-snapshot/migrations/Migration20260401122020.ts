import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401122020 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "sale_snapshot"
      add column if not exists "raw_amount_paid" jsonb not null
      default '{"value":"0","precision":20}';
    `)

    this.addSql(`
      update "sale_snapshot"
      set "raw_amount_paid" = jsonb_build_object(
        'value',
        coalesce("amount_paid", 0)::text,
        'precision',
        20
      )
      where "raw_amount_paid" is null
         or "raw_amount_paid" = '{"value":"0","precision":20}'::jsonb;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "sale_snapshot"
      drop column if exists "raw_amount_paid";
    `)
  }
}
