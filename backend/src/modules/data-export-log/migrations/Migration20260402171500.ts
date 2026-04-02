import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260402171500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "data_export_log" (
        "id" text not null,
        "partner_id" text not null,
        "query_params" jsonb not null,
        "result_row_count" integer not null default 0,
        "format" text check ("format" in ('csv', 'json', 'api')) not null default 'api',
        "data_type" text not null,
        "consent_verified" boolean not null default true,
        "min_aggregation_threshold" integer not null default 10,
        "pii_filtered" boolean not null default true,
        "aggregation_threshold_met" boolean not null default true,
        "quota_used" integer not null default 0,
        "billing_amount" integer not null default 0,
        "requested_at" timestamptz not null,
        "completed_at" timestamptz null,
        "expires_at" timestamptz null,
        "ip_address" text null,
        "user_agent" text null,
        "status" text check ("status" in ('pending', 'completed', 'failed', 'rejected')) not null default 'pending',
        "error_message" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "data_export_log_pkey" primary key ("id")
      );
    `)

    this.addSql(`
      create index if not exists "idx_data_export_log_partner_requested_at"
      on "data_export_log" ("partner_id", "requested_at")
      where "deleted_at" is null;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "idx_data_export_log_partner_requested_at";`)
    this.addSql(`drop table if exists "data_export_log" cascade;`)
  }
}
