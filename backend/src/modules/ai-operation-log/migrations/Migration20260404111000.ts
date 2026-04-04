import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260404111000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_operation_log" (
        "id" text not null,
        "shop_id" text not null,
        "operation_type" text not null,
        "provider" text not null,
        "model" text not null,
        "prompt_tokens" integer not null default 0,
        "completion_tokens" integer not null default 0,
        "total_tokens" integer not null default 0,
        "cost_kes" numeric not null default 0,
        "latency_ms" integer not null default 0,
        "success" boolean not null default true,
        "error_message" text null,
        "request_excerpt" text null,
        "response_excerpt" text null,
        "metadata" jsonb null,
        "occurred_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_operation_log_pkey" primary key ("id")
      );
    `)
    this.addSql(`
      create index if not exists "idx_ai_operation_log_shop_occurred"
      on "ai_operation_log" ("shop_id", "occurred_at")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_ai_operation_log_shop_occurred";`)
    this.addSql(`drop table if exists "ai_operation_log" cascade;`)
  }
}
