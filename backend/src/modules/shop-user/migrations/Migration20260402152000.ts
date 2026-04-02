import { Migration } from "@mikro-orm/migrations"

export class Migration20260402152000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "shop_user" add column if not exists "assigned_terminal_ids" jsonb null;'
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      'alter table "shop_user" drop column if exists "assigned_terminal_ids";'
    )
  }
}
