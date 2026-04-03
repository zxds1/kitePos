import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { authenticatePosJwt, type PosAuthenticatedRequest } from "../../../auth/_utils/jwt"
import { NOTIFICATION_MODULE } from "../../../../modules/notification"
import { NotificationService } from "../../../../services/notification.service"

const MarkReadSchema = z.object({
  in_app_read: z.literal(true),
})

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const parsed = MarkReadSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Invalid notification update" })
    return
  }

  const service = req.scope.resolve(NOTIFICATION_MODULE) as unknown as {
    listAndCountNotifications: (
      filters: Record<string, unknown>,
      config: Record<string, unknown>
    ) => Promise<[Array<Record<string, unknown>>, number]>
  }
  const [notifications] = await service.listAndCountNotifications(
    { id: req.params.id, shop_id: auth.shop_id },
    { take: 1 }
  )
  if (!notifications[0]) {
    res.status(404).json({ success: false, message: "Notification not found" })
    return
  }

  await new NotificationService(req.scope).markAsRead(req.params.id)
  res.status(200).json({ success: true })
}
