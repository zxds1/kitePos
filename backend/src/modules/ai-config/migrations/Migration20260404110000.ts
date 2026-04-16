import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404110000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_config" (
        "id" text not null,
        "scope" text check ("scope" in ('platform', 'shop')) not null default 'platform',
        "shop_id" text null,
        "litellm_base_url" text not null default 'http://localhost:4000',
        "litellm_api_key" text null,
        "default_provider" text check ("default_provider" in ('openai', 'anthropic', 'google', 'azure', 'local')) not null default 'openai',
        "default_model" text not null default 'gpt-3.5-turbo',
        "fallback_models" jsonb null,
        "max_tokens_per_request" integer not null default 500,
        "max_tokens_per_day" integer not null default 10000,
        "max_cost_per_day" numeric null,
        "preferred_tier" text check ("preferred_tier" in ('budget', 'balanced', 'premium')) not null default 'budget',
        "intent_rules" jsonb null,
        "escalation_rules" jsonb null,
        "chatbot_enabled" boolean not null default true,
        "chatbot_personality" text check ("chatbot_personality" in ('friendly', 'professional', 'casual', 'formal')) not null default 'friendly',
        "chatbot_language" text check ("chatbot_language" in ('en', 'sw', 'both')) not null default 'both',
        "chatbot_welcome_message" text null,
        "recommendations_enabled" boolean not null default true,
        "recommendations_algorithm" text check ("recommendations_algorithm" in ('rules_only', 'ai_only', 'hybrid')) not null default 'hybrid',
        "recommendations_cache_hours" integer not null default 24,
        "inventory_ai_enabled" boolean not null default true,
        "pricing_ai_enabled" boolean not null default true,
        "marketing_ai_enabled" boolean not null default true,
        "analytics_ai_enabled" boolean not null default true,
        "assistant_access_level" text not null default 'confirm_writes',
        "assistant_full_access" boolean not null default false,
        "total_tokens_used" integer not null default 0,
        "total_cost" numeric not null default 0,
        "last_reset_at" timestamptz null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_config_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create unique index if not exists "idx_ai_config_scope_shop"
      on "ai_config" ("scope", coalesce("shop_id", 'platform'))
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_ai_config_scope_shop";`)
    this.addSql(`drop table if exists "ai_config" cascade;`)
  }
}
