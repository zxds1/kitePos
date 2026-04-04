import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      drop constraint if exists "ai_config_default_provider_check";
    `)
    this.addSql(`
      alter table if exists "ai_config"
      add column if not exists "provider_options" jsonb null,
      add column if not exists "model_options" jsonb null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      drop column if exists "provider_options",
      drop column if exists "model_options";
    `)
    this.addSql(`
      alter table if exists "ai_config"
      add constraint "ai_config_default_provider_check"
      check ("default_provider" in ('openai', 'anthropic', 'google', 'azure', 'local'));
    `)
  }
}
