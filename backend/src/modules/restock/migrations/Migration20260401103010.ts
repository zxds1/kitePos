import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401103010 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create index if not exists "idx_restock_shop_variant"
      on "restock" ("shop_id", "variant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_restock_shop_variant";`)
  }
}
