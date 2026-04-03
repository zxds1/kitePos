import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../auth/_utils/jwt"
import { NOTIFICATION_MODULE } from "../../../modules/notification"
import { NotificationService } from "../../../services/notification.service"

const MarkAllSchema = z.object({
  mark_all_read: z.boolean(),
})

function shapeNotification(notification: Record<string, unknown>) {
  return {
    id: String(notification.id),
    shop_id: String(notification.shop_id),
    user_type: String(notification.user_type ?? "retailer"),
    type: String(notification.type ?? "new_order"),
    title: String(notification.title ?? "Notification"),
    message: String(notification.message ?? ""),
    data:
      notification.data && typeof notification.data === "object"
        ? notification.data
        : null,
    push_sent: notification.push_sent === true,
    sms_sent: notification.sms_sent === true,
    email_sent: notification.email_sent === true,
    in_app_read: notification.in_app_read === true,
    read_at: notification.read_at ?? null,
    created_at: notification.created_at ?? null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service = req.scope.resolve(NOTIFICATION_MODULE) as unknown as {
    listAndCountNotifications: (
      filters: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<[Array<Record<string, unknown>>, number]>
  }
  const unreadOnly = req.query.unread === "true"
  const [notifications] = await service.listAndCountNotifications(
    {
      shop_id: auth.shop_id,
      ...(unreadOnly ? { in_app_read: false } : {}),
    },
    { take: 100, order: { created_at: "DESC" } }
  )

  res.status(200).json({
    success: true,
    notifications: (notifications as Array<Record<string, unknown>>).map(
      shapeNotification
    ),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = MarkAllSchema.safeParse(req.body)
  if (!parsed.success || parsed.data.mark_all_read != true) {
    res.status(400).json({ success: false, message: "Invalid notification update" })
    return
  }

  await new NotificationService(req.scope).markAllAsRead(auth.shop_id)
  res.status(200).json({ success: true })
}
