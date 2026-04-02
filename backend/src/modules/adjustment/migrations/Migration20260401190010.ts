import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401190010 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create unique index if not exists "idx_adjustment_reference_unique"
      on "adjustment" ("reference")
      where "reference" is not null and "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_adjustment_reference_unique";`)
  }
}
