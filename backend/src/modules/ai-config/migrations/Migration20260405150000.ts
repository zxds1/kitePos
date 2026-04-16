import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260405150000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      add column if not exists "raw_max_cost_per_day" jsonb null,
      add column if not exists "raw_similarity_threshold" jsonb null,
      add column if not exists "raw_total_cost" jsonb null;
    `)

    this.addSql(`
      update "ai_config"
      set
        "raw_max_cost_per_day" = coalesce(
          "raw_max_cost_per_day",
          jsonb_build_object(
            'value',
            coalesce("max_cost_per_day", 50)::text,
            'precision',
            20
          )
        ),
        "raw_similarity_threshold" = coalesce(
          "raw_similarity_threshold",
          jsonb_build_object(
            'value',
            coalesce("similarity_threshold", 0.7)::text,
            'precision',
            20
          )
        ),
        "raw_total_cost" = coalesce(
          "raw_total_cost",
          jsonb_build_object(
            'value',
            coalesce("total_cost", 0)::text,
            'precision',
            20
          )
        );
    `)

    this.addSql(`
      alter table if exists "ai_config"
      alter column "raw_max_cost_per_day" set default '{"value":"50","precision":20}'::jsonb,
      alter column "raw_similarity_threshold" set default '{"value":"0.7","precision":20}'::jsonb,
      alter column "raw_total_cost" set default '{"value":"0","precision":20}'::jsonb,
      alter column "raw_max_cost_per_day" set not null,
      alter column "raw_similarity_threshold" set not null,
      alter column "raw_total_cost" set not null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table if exists "ai_config"
      drop column if exists "raw_max_cost_per_day",
      drop column if exists "raw_similarity_threshold",
      drop column if exists "raw_total_cost";
    `)
  }
}
