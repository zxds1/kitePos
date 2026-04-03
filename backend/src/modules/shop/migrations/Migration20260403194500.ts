import { Migration } from "@mikro-orm/migrations"

export class Migration20260403194500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      add column if not exists "industry_types" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "shop"
      drop column if exists "industry_types";
    `)
  }
}
