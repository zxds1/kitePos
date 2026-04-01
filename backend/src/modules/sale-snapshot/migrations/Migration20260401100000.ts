import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      delete from "sale_snapshot"
      where "id" in (
        select "id"
        from (
          select
            "id",
            row_number() over (
              partition by "line_item_id"
              order by "created_at" asc, "id" asc
            ) as "row_num"
          from "sale_snapshot"
          where "deleted_at" is null
            and "line_item_id" like 'offline-item:%'
        ) as duplicate_rows
        where duplicate_rows."row_num" > 1
      );
    `)

    this.addSql(`
      create unique index if not exists "IDX_sale_snapshot_offline_line_item_unique"
      on "sale_snapshot" ("line_item_id")
      where "deleted_at" is null
        and "line_item_id" like 'offline-item:%';
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      drop index if exists "IDX_sale_snapshot_offline_line_item_unique";
    `)
  }
}
