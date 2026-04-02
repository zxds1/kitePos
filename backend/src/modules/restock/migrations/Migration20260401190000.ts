import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "restock"
      add column if not exists "idempotency_key" text null;
    `)

    this.addSql(`
      create unique index if not exists "idx_restock_idempotency_key_unique"
      on "restock" ("idempotency_key")
      where "idempotency_key" is not null and "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_restock_idempotency_key_unique";`)
    this.addSql(`
      alter table if exists "restock"
      drop column if exists "idempotency_key";
    `)
  }
}
