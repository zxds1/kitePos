import type { MedusaContainer } from "@medusajs/framework/types"
import { AUTO_REORDER_RULE_MODULE } from "../modules/auto-reorder-rule"
import type AutoReorderRuleModuleService from "../modules/auto-reorder-rule/service"
import { PURCHASE_ORDER_MODULE } from "../modules/purchase-order"
import type PurchaseOrderModuleService from "../modules/purchase-order/service"
import { SHOP_MODULE } from "../modules/shop"
import type ShopModuleService from "../modules/shop/service"
import { calculateServerStock } from "../utils/stock-calculator"
import { NotificationService } from "./notification.service"
import {
  computeDeliveryFee,
  createPurchaseOrderRecord,
  getSupplierShop,
  listSupplierCatalog,
  normalizeDeliveryOptions,
} from "../api/pos/suppliers/_utils/network"

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export class AutoReorderService {
  constructor(private readonly container: MedusaContainer) {}

  private get rules() {
    return this.container.resolve<AutoReorderRuleModuleService>(
      AUTO_REORDER_RULE_MODULE
    )
  }

  private get purchaseOrders() {
    return this.container.resolve<PurchaseOrderModuleService>(
      PURCHASE_ORDER_MODULE
    )
  }

  private get shops() {
    return this.container.resolve<ShopModuleService>(SHOP_MODULE)
  }

  async checkAndTriggerReorders() {
    const rules = await this.rules.listAutoReorderRules(
      { is_active: true },
      { take: 500, order: { created_at: "ASC" } }
    )

    for (const rule of rules as Array<Record<string, unknown>>) {
      try {
        if (!(await this.shouldTriggerRule(rule))) {
          continue
        }

        const supplierShopId = String(rule.supplier_shop_id)
        const catalog = await listSupplierCatalog(
          { scope: this.container } as never,
          supplierShopId
        )
        const catalogItem = catalog.find(
          (item) => item.variant_id === String(rule.variant_id)
        )
        if (!catalogItem) {
          continue
        }
        if (await this.hasOpenAutoReorderOrder(String(rule.id))) {
          continue
        }
        const maxPrice = toNumber(rule.max_price)
        if (maxPrice > 0 && catalogItem.wholesale_price > maxPrice) {
          continue
        }

        const supplierShop = await getSupplierShop(this.container, supplierShopId)
        if (!supplierShop) {
          continue
        }

        const deliveryOptions = normalizeDeliveryOptions(
          supplierShop.delivery_options
        )
        const quantity = toNumber(rule.order_quantity)
        const subtotal = Number((catalogItem.wholesale_price * quantity).toFixed(2))
        const deliveryFee = computeDeliveryFee(deliveryOptions, subtotal)

        const order = await createPurchaseOrderRecord(this.container, {
          retailer_shop_id: String(rule.retailer_shop_id),
          supplier_shop_id: supplierShopId,
          items: [
            {
              variant_id: catalogItem.variant_id,
              product_name: catalogItem.product_name,
              quantity,
              unit_price: catalogItem.wholesale_price,
              subtotal,
            },
          ],
          subtotal_amount: subtotal,
          total_amount: subtotal + deliveryFee,
          delivery_method: "delivery",
          delivery_fee: deliveryFee,
          auto_reorder_rule_id: String(rule.id),
          status: rule.auto_approve === true ? "confirmed" : "pending",
          metadata: { trigger_type: rule.trigger_type ?? "stock_threshold" },
        })

        await this.rules.updateAutoReorderRules([
          {
            id: String(rule.id),
            last_ordered_at: new Date(),
          },
        ] as Record<string, unknown>[])

        const notifications = new NotificationService(this.container)
        await notifications.sendNotification({
          shopId: supplierShopId,
          userType: "supplier",
          type: "new_order",
          title: "New auto-reorder order",
          message: `A reorder request has been created for ${catalogItem.product_name}.`,
          data: { order_id: (order as Record<string, unknown>).id },
          channels: ["push", "sms", "in_app"],
        })
        await notifications.sendNotification({
          shopId: String(rule.retailer_shop_id),
          userType: "retailer",
          type:
            rule.auto_approve === true ? "new_order" : "reorder_suggestion",
          title:
            rule.auto_approve === true
                ? "Auto-reorder placed"
                : "Reorder suggestion created",
          message:
            rule.auto_approve === true
                ? `Order for ${catalogItem.product_name} has been sent automatically.`
                : `A supplier confirmation is pending for ${catalogItem.product_name}.`,
          data: { order_id: (order as Record<string, unknown>).id },
          channels: ["push", "in_app"],
        })
      } catch (_) {
        // Continue processing other rules.
      }
    }
  }

  private async shouldTriggerRule(rule: Record<string, unknown>) {
    if (await this.isOverBudget(rule)) {
      return false
    }

    switch (String(rule.trigger_type ?? "stock_threshold")) {
      case "schedule":
        return this.checkSchedule(rule)
      case "predictive":
        return false
      case "stock_threshold":
      default:
        return this.checkStockThreshold(rule)
    }
  }

  private async checkStockThreshold(rule: Record<string, unknown>) {
    const threshold = toNumber(rule.stock_threshold)
    if (threshold <= 0) {
      return false
    }
    const stock = await calculateServerStock(
      this.container,
      String(rule.retailer_shop_id),
      String(rule.variant_id)
    )
    return stock <= threshold
  }

  private checkSchedule(rule: Record<string, unknown>) {
    const frequency = toNumber(rule.schedule_frequency_days)
    if (frequency <= 0) {
      return false
    }
    const lastOrderedAt =
      rule.last_ordered_at == null ? null : new Date(String(rule.last_ordered_at))
    if (!lastOrderedAt) {
      return true
    }
    const elapsedDays =
      (Date.now() - lastOrderedAt.getTime()) / (1000 * 60 * 60 * 24)
    return elapsedDays >= frequency
  }

  private async isOverBudget(rule: Record<string, unknown>) {
    const limit = toNumber(rule.budget_limit_monthly)
    if (limit <= 0) {
      return false
    }

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)

    const orders = await this.purchaseOrders.listPurchaseOrders(
      {
        retailer_shop_id: String(rule.retailer_shop_id),
        supplier_shop_id: String(rule.supplier_shop_id),
      },
      { take: 500, order: { created_at: "DESC" } }
    )

    const spent = (orders as Array<Record<string, unknown>>)
      .filter((order) => {
        const createdAt =
          order.created_at == null ? null : new Date(String(order.created_at))
        return createdAt != null && createdAt >= monthStart
      })
      .reduce((sum, order) => sum + toNumber(order.total_amount), 0)

    return spent >= limit
  }

  private async hasOpenAutoReorderOrder(ruleId: string) {
    const orders = await this.purchaseOrders.listPurchaseOrders(
      { auto_reorder_rule_id: ruleId },
      { take: 50, order: { created_at: "DESC" } }
    )

    return (orders as Array<Record<string, unknown>>).some((order) => {
      const status = String(order.status ?? "pending")
      return status !== "cancelled" && status !== "delivered"
    })
  }
}
