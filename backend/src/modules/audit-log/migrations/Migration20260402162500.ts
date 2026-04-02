import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402162500 extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "audit_log" add column if not exists "previous_hash" text null;')
    this.addSql('alter table "audit_log" add column if not exists "entry_hash" text null;')
    this.addSql(`
      create unique index if not exists "idx_audit_log_entry_hash_unique"
      on "audit_log" ("entry_hash")
      where "deleted_at" is null and "entry_hash" is not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql('drop index if exists "idx_audit_log_entry_hash_unique";')
    this.addSql('alter table "audit_log" drop column if exists "previous_hash";')
    this.addSql('alter table "audit_log" drop column if exists "entry_hash";')
  }
}
