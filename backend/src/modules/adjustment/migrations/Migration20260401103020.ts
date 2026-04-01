import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401103020 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create index if not exists "idx_adjustment_shop_variant"
      on "adjustment" ("shop_id", "variant_id");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_adjustment_shop_variant";`)
  }
}
