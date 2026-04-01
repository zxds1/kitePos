import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260401160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "otp_challenge" (
        "id" text not null,
        "phone_hash" text not null,
        "otp_hash" text not null,
        "channel" text not null default 'sms',
        "expires_at" timestamptz not null,
        "consumed_at" timestamptz null,
        "last_sent_at" timestamptz not null,
        "attempt_count" integer not null default 0,
        "resend_count" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "otp_challenge_pkey" primary key ("id"),
        constraint "otp_challenge_channel_check" check ("channel" in ('sms'))
      );
    `)

    this.addSql(`
      create index if not exists "IDX_otp_challenge_deleted_at"
      on "otp_challenge" ("deleted_at")
      where "deleted_at" is null;
    `)
    this.addSql(`create index if not exists "idx_otp_challenge_phone_hash" on "otp_challenge" ("phone_hash");`)
    this.addSql(`create index if not exists "idx_otp_challenge_expires_at" on "otp_challenge" ("expires_at");`)
    this.addSql(`create index if not exists "idx_otp_challenge_consumed_at" on "otp_challenge" ("consumed_at");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "otp_challenge" cascade;`)
  }
}
