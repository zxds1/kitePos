import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260401093032 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "sale_snapshot" add column if not exists "client_transaction_id" text null, add column if not exists "quantity_sold" numeric not null default 1, add column if not exists "price_charged" numeric not null default 0, add column if not exists "payment_method" text null, add column if not exists "raw_quantity_sold" jsonb not null default '{"value":"1","precision":20}', add column if not exists "raw_price_charged" jsonb not null default '{"value":"0","precision":20}';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "sale_snapshot" drop column if exists "client_transaction_id", drop column if exists "quantity_sold", drop column if exists "price_charged", drop column if exists "payment_method", drop column if exists "raw_quantity_sold", drop column if exists "raw_price_charged";`);
  }

}
