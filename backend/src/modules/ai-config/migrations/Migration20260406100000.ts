import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260406100000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      add column if not exists "assistant_access_level" text not null default 'confirm_writes',
      add column if not exists "assistant_full_access" boolean not null default false;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      drop column if exists "assistant_access_level",
      drop column if exists "assistant_full_access";
    `)
  }
}
