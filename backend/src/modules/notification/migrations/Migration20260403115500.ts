import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260403115500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "notification"
      drop constraint if exists "notification_type_check";
    `)
    this.addSql(`
      alter table "notification"
      add constraint "notification_type_check"
      check ("type" in (
        'new_order',
        'order_confirmed',
        'order_dispatched',
        'order_delivered',
        'low_stock',
        'reorder_suggestion',
        'connection_request',
        'price_change',
        'new_return_request',
        'b2b_return_request',
        'return_approved',
        'return_rejected',
        'refund_processed',
        'return_received'
      ));
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "notification"
      drop constraint if exists "notification_type_check";
    `)
    this.addSql(`
      alter table "notification"
      add constraint "notification_type_check"
      check ("type" in (
        'new_order',
        'order_confirmed',
        'order_dispatched',
        'order_delivered',
        'low_stock',
        'reorder_suggestion',
        'connection_request',
        'price_change'
      ));
    `)
  }
}
