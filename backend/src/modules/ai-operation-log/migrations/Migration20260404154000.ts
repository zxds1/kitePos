import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404154000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_operation_log"
      add column if not exists "rag_source" text not null default 'llm',
      add column if not exists "cache_hit" boolean not null default false,
      add column if not exists "cached" boolean not null default false;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_operation_log"
      drop column if exists "rag_source",
      drop column if exists "cache_hit",
      drop column if exists "cached";
    `)
  }
}
