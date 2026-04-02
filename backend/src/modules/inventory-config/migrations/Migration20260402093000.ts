import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260402093000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "inventory_config" add column if not exists "shop_id" text null;`
    )

    this.addSql(`
      update "inventory_config" as ic
      set "shop_id" = p."metadata"->>'pos_shop_id'
      from "product_variant" pv
      join "product" p on p.id = pv.product_id
      where pv.id = ic.variant_id
        and ic.shop_id is null
        and p.metadata ? 'pos_shop_id'
    `)

    this.addSql(
      `create index if not exists "idx_inventory_config_shop_variant" on "inventory_config" ("shop_id", "variant_id");`
    )
    this.addSql(
      `create index if not exists "idx_inventory_config_shop_active" on "inventory_config" ("shop_id", "is_active") where deleted_at is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "idx_inventory_config_shop_variant";`
    )
    this.addSql(
      `drop index if exists "idx_inventory_config_shop_active";`
    )
    this.addSql(
      `alter table if exists "inventory_config" drop column if exists "shop_id";`
    )
  }
}
