import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403203000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "shop" drop constraint if exists "shop_shop_type_check";`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "shop" drop constraint if exists "shop_shop_type_check";`
    )
    this.addSql(`
      alter table if exists "shop"
      add constraint "shop_shop_type_check"
      check ("shop_type" in (
        'retail_duka',
        'wholesale_supplier',
        'fashion_retail',
        'fashion_vendor',
        'electronics_retail',
        'electronics_vendor',
        'electronics_repair',
        'fashion_tailoring',
        'cereals_store'
      ));
    `)
  }
}
