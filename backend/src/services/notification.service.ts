import { NOTIFICATION_MODULE } from "../modules/notification"
import type NotificationModuleService from "../modules/notification/service"
import { SHOP_MODULE } from "../modules/shop"
import type ShopModuleService from "../modules/shop/service"
import type { MedusaContainer } from "@medusajs/framework/types"

type NotificationUserType = "retailer" | "supplier" | "admin"

export class NotificationService {
  constructor(private readonly container: MedusaContainer) {}

  private get notificationModule() {
    return this.container.resolve<NotificationModuleService>(NOTIFICATION_MODULE)
  }

  private get shopModule() {
    return this.container.resolve<ShopModuleService>(SHOP_MODULE)
  }

  async sendNotification(input: {
    shopId: string
    userType: NotificationUserType
    type:
      | "new_order"
      | "order_confirmed"
      | "order_dispatched"
      | "order_delivered"
      | "low_stock"
      | "reorder_suggestion"
      | "connection_request"
      | "price_change"
      | "new_return_request"
      | "b2b_return_request"
      | "return_approved"
      | "return_rejected"
      | "refund_processed"
      | "return_received"
    title: string
    message: string
    data?: Record<string, unknown> | null
    channels?: Array<"push" | "sms" | "email" | "in_app">
  }) {
    const channels = input.channels ?? ["push", "in_app"]

    let created: unknown = null
    try {
      created = await this.notificationModule.createNotifications({
        shop_id: input.shopId,
        user_type: input.userType,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? null,
        push_sent: channels.includes("push"),
        sms_sent: channels.includes("sms"),
        email_sent: channels.includes("email"),
        in_app_read: false,
      } as Record<string, unknown>)
    } catch (_) {
      // Keep commerce flows resilient while notification storage catches up.
      created = null
    }

    if (channels.includes("sms")) {
      await this.sendSmsFallback(input.shopId, input.message)
    }

    return created
  }

  async getUnreadNotifications(shopId: string) {
    return this.notificationModule.listNotifications(
      { shop_id: shopId, in_app_read: false },
      { order: { created_at: "DESC" }, take: 50 }
    )
  }

  async markAsRead(notificationId: string) {
    const [updated] = await this.notificationModule.updateNotifications([
      {
        id: notificationId,
        in_app_read: true,
        read_at: new Date(),
      },
    ] as Record<string, unknown>[])
    return updated
  }

  async markAllAsRead(shopId: string) {
    const notifications = await this.notificationModule.listNotifications(
      { shop_id: shopId, in_app_read: false },
      { take: 200 }
    )

    for (const notification of notifications as Array<Record<string, unknown>>) {
      await this.markAsRead(String(notification.id))
    }
  }

  private async sendSmsFallback(shopId: string, message: string) {
    const [shops] = await this.shopModule.listAndCountShops(
      { id: shopId },
      { take: 1 }
    )
    const shop = shops[0] as Record<string, unknown> | undefined
    const phone =
      typeof shop?.mpesa_phone === "string"
        ? shop?.mpesa_phone
        : null

    if (!phone || !process.env.AT_API_KEY) {
      return
    }

    try {
      await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apikey: process.env.AT_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: process.env.AT_USERNAME || "sandbox",
          to: phone,
          message,
        }),
      })
    } catch (_) {
      // Keep notification creation resilient even if downstream delivery fails.
    }
  }
}
