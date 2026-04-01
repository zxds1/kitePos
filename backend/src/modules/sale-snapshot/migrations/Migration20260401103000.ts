import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401103000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "sale_snapshot"
      add column if not exists "sync_status" text not null default 'success',
      add column if not exists "sync_conflict" jsonb null;
    `)

    this.addSql(`
      delete from "sale_snapshot"
      where "id" in (
        select "id"
        from (
          select
            "id",
            row_number() over (
              partition by "client_transaction_id", "shop_id"
              order by "created_at" asc, "id" asc
            ) as "row_num"
          from "sale_snapshot"
          where "deleted_at" is null
            and "client_transaction_id" is not null
        ) as duplicate_rows
        where duplicate_rows."row_num" > 1
      );
    `)

    this.addSql(`
      create unique index if not exists "idx_sale_snapshot_unique_txn"
      on "sale_snapshot" ("client_transaction_id", "shop_id")
      where "deleted_at" is null
        and "client_transaction_id" is not null;
    `)

    this.addSql(`
      create index if not exists "idx_sale_snapshot_shop_variant"
      on "sale_snapshot" ("shop_id", "variant_id");
    `)

    this.addSql(`
      create index if not exists "idx_sale_snapshot_timestamp"
      on "sale_snapshot" ("timestamp");
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_sale_snapshot_unique_txn";`)
    this.addSql(`drop index if exists "idx_sale_snapshot_shop_variant";`)
    this.addSql(`drop index if exists "idx_sale_snapshot_timestamp";`)
    this.addSql(`
      alter table if exists "sale_snapshot"
      drop column if exists "sync_status",
      drop column if exists "sync_conflict";
    `)
  }
}
