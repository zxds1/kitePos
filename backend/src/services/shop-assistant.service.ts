import { randomUUID } from "node:crypto"
import type { MedusaRequest } from "@medusajs/framework/http"
import { SALE_SNAPSHOT_MODULE } from "../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../modules/sale-snapshot/service"
import { AIService } from "./ai.service"
import { InventoryAIService } from "./inventory-ai.service"
import { listNormalizedProducts } from "../api/admin/products/_utils"
import { POST as adminCreateProduct } from "../api/admin/products/route"
import { POST as adminCreateRestock } from "../api/admin/restocks/route"
import { PATCH as adminAdjustStock } from "../api/admin/products/[id]/stock/route"
import { loadPrompt, renderPrompt } from "../utils/prompt-loader"

export type AssistantTask =
  | "low_stock"
  | "product_search"
  | "sales_summary"
  | "general"
  | "write_product"
  | "write_restock"
  | "write_adjustment"
  | "write_store"

export type AssistantWriteTask = Extract<
  AssistantTask,
  "write_product" | "write_restock" | "write_adjustment" | "write_store"
>

export type AssistantToolKind =
  | "create_product"
  | "create_restock"
  | "adjust_stock"
  | "create_store"

export type AssistantToolRequest = {
  id: string
  kind: AssistantToolKind
  title: string
  summary: string
  payload: Record<string, unknown>
  confirm_label: string
  cancel_label: string
}

export type AssistantConfirmedAction = {
  id?: string
  kind: AssistantToolKind
  payload: Record<string, unknown>
}

export type AssistantResponse = {
  task: AssistantTask
  response: string
  actions: string[]
  data: Record<string, unknown>
  tool_request?: AssistantToolRequest
  requires_confirmation?: boolean
}

type ToolPlannerResult = {
  kind?: AssistantToolKind | "none"
  title?: string
  summary?: string
  payload?: Record<string, unknown>
}

type AssistantAccessLevel =
  | "read_only"
  | "confirm_writes"
  | "full_access"

export class ShopAssistantService {
  private readonly aiService: AIService
  private readonly inventoryService: InventoryAIService

  constructor(private readonly req: MedusaRequest) {
    this.aiService = new AIService(req.scope)
    this.inventoryService = new InventoryAIService()
  }

  async run(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
    confirmedAction?: AssistantConfirmedAction | null
  }): Promise<AssistantResponse> {
    const config = await this.aiService.resolveConfig(input.shopId)
    const accessLevel = this.resolveAssistantAccessLevel(config)

    if (input.confirmedAction) {
      if (accessLevel === "read_only") {
        return {
          task: "general",
          response:
            "This assistant is set to read-only, so it cannot execute shop writes yet.",
          actions: ["Open AI settings", "Switch to confirm writes", "Switch to full access"],
          data: {},
        }
      }
      return this.executeConfirmedAction(input, input.confirmedAction)
    }

    const writeTask = this.classifyWriteTask(input.query)
    if (writeTask) {
      if (accessLevel === "read_only") {
        return this.handleReadOnlyWriteTask({
          ...input,
          writeTask,
        })
      }
      if (accessLevel === "full_access") {
        return this.executeWriteTask({
          ...input,
          writeTask,
        })
      }
      return this.handleWriteTask({
        ...input,
        writeTask,
      })
    }

    const task = this.classifyTask(input.query)

    switch (task) {
      case "low_stock":
        return this.handleLowStock(input)
      case "product_search":
        return this.handleProductSearch(input)
      case "sales_summary":
        return this.handleSalesSummary(input)
      default:
        return this.handleGeneral(input)
    }
  }

  private resolveAssistantAccessLevel(config: Record<string, unknown>): AssistantAccessLevel {
    const level = String(config.assistant_access_level ?? "").trim()
    if (
      level === "read_only" ||
      level === "confirm_writes" ||
      level === "full_access"
    ) {
      return level
    }
    if (config.assistant_full_access === true) {
      return "full_access"
    }
    return "confirm_writes"
  }

  private classifyWriteTask(query: string): AssistantWriteTask | null {
    const normalized = query.toLowerCase()
    if (
      [
        "create online store",
        "new online store",
        "build storefront",
        "create storefront",
        "online store",
        "storefront",
      ].some((term) => normalized.includes(term))
    ) {
      return "write_store"
    }
    if (
      ["create product", "new product", "add product", "make product"].some((term) =>
        normalized.includes(term)
      )
    ) {
      return "write_product"
    }
    if (["restock", "reorder", "receive stock", "supplier delivery"].some((term) =>
      normalized.includes(term)
    )) {
      return "write_restock"
    }
    if (["adjust stock", "stock correction", "wastage", "theft", "expiry"].some((term) =>
      normalized.includes(term)
    )) {
      return "write_adjustment"
    }
    return null
  }

  private classifyTask(query: string): AssistantTask {
    const normalized = query.toLowerCase()
    if (
      ["low stock", "stock", "inventory", "restock", "reorder", "understock"].some((term) =>
        normalized.includes(term)
      )
    ) {
      return "low_stock"
    }

    if (
      ["sales", "revenue", "turnover", "transactions", "summary", "today", "daily"].some(
        (term) => normalized.includes(term)
      )
    ) {
      return "sales_summary"
    }

    if (
      ["find", "search", "lookup", "product", "item", "barcode", "sku", "milk", "shoe"].some(
        (term) => normalized.includes(term)
      )
    ) {
      return "product_search"
    }

    return "general"
  }

  private async handleLowStock(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const lowStock = await this.inventoryService.getInsights(this.req, input.shopId)
    const topItems = lowStock.slice(0, 5)
    const summary =
      topItems.length > 0
        ? `I found ${topItems.length} low-stock items for ${input.shopName}.`
        : `I could not find any low-stock items for ${input.shopName}.`

    const response = await this.summarizeTask({
      shopId: input.shopId,
      task: "low_stock",
      query: input.query,
      model: input.model,
      payload: {
        shop_name: input.shopName,
        low_stock_items: topItems,
      },
      fallback: summary,
    })

    return {
      task: "low_stock",
      response,
      actions: ["Open reports", "Open sales", "Check low stock"],
      data: {
        low_stock_items: topItems,
      },
    }
  }

  private async handleProductSearch(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const products = await listNormalizedProducts(this.req, { shopId: input.shopId })
    const tokens = this.tokenize(input.query)
    const matches = products
      .filter((product) => {
        const haystack = [
          product.name,
          product.category ?? "",
          product.brand ?? "",
          product.style_code ?? "",
          product.model_name ?? "",
          product.serial_number ?? "",
          product.imei ?? "",
        ]
          .join(" ")
          .toLowerCase()
        return tokens.some((token) => haystack.includes(token))
      })
      .sort((a, b) => a.stock_remaining - b.stock_remaining)
      .slice(0, 5)

    const summary =
      matches.length > 0
        ? `I found ${matches.length} matching products in ${input.shopName}.`
        : `I could not find a clear product match in ${input.shopName}.`

    const response = await this.summarizeTask({
      shopId: input.shopId,
      task: "product_search",
      query: input.query,
      model: input.model,
      payload: {
        shop_name: input.shopName,
        matches,
      },
      fallback: summary,
    })

    return {
      task: "product_search",
      response,
      actions: ["Scan barcode", "Open sales", "Open reports"],
      data: {
        matches,
      },
    }
  }

  private async handleSalesSummary(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const saleSnapshotService: SaleSnapshotModuleService = this.req.scope.resolve(
      SALE_SNAPSHOT_MODULE
    )
    const [snapshots] = await saleSnapshotService.listAndCountSaleSnapshots(
      { shop_id: input.shopId },
      { take: 30, order: { timestamp: "DESC" } }
    )

    const recentSales = (snapshots as Array<Record<string, unknown>>).slice(0, 30)
    const totalRevenue = recentSales.reduce(
      (sum, sale) => sum + this.asNumber(sale.price_charged ?? sale.amount_paid),
      0
    )
    const totalTransactions = recentSales.length
    const cashTransactions = recentSales.filter(
      (sale) => String(sale.payment_method ?? "cash").toLowerCase() === "cash"
    ).length
    const mpesaTransactions = recentSales.filter((sale) =>
      String(sale.payment_method ?? "").toLowerCase().includes("mpesa")
    ).length

    const response = await this.summarizeTask({
      shopId: input.shopId,
      task: "sales_summary",
      query: input.query,
      model: input.model,
      payload: {
        shop_name: input.shopName,
        total_recent_sales: totalTransactions,
        total_revenue: totalRevenue,
        cash_transactions: cashTransactions,
        mpesa_transactions: mpesaTransactions,
        recent_sales: recentSales.slice(0, 5),
      },
      fallback: `I reviewed ${totalTransactions} recent sales for ${input.shopName}.`,
    })

    return {
      task: "sales_summary",
      response,
      actions: ["Open reports", "Open sales", "Open AI settings"],
      data: {
        total_recent_sales: totalTransactions,
        total_revenue: totalRevenue,
        cash_transactions: cashTransactions,
        mpesa_transactions: mpesaTransactions,
      },
    }
  }

  private async handleGeneral(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const response = await this.summarizeTask({
      shopId: input.shopId,
      task: "general",
      query: input.query,
      model: input.model,
      payload: {
        shop_name: input.shopName,
      },
      fallback:
        "I can check stock, search products, summarize sales, or help with capture and backfill.",
    })

    return {
      task: "general",
      response,
      actions: ["Check low stock", "Open reports", "Scan barcode"],
      data: {},
    }
  }

  private async handleWriteTask(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
    writeTask: AssistantWriteTask
  }): Promise<AssistantResponse> {
    const products = await listNormalizedProducts(this.req, { shopId: input.shopId })
    const matchedProduct = this.matchProduct(input.query, products)

    switch (input.writeTask) {
      case "write_store":
        return this.draftCreateStore(input)
      case "write_product":
        return this.draftCreateProduct(input)
      case "write_restock":
        return this.draftCreateRestock(input, matchedProduct)
      case "write_adjustment":
        return this.draftAdjustStock(input, matchedProduct)
      default:
        return this.handleGeneral(input)
    }
  }

  private async handleReadOnlyWriteTask(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
    writeTask: AssistantWriteTask
  }): Promise<AssistantResponse> {
    const guidance = {
      write_store:
        "I can prepare a storefront draft, but this assistant is set to read-only, so I cannot create the store yet.",
      write_product:
        "I can prepare product ideas, but this assistant is set to read-only, so I cannot create the product yet.",
      write_restock:
        "I can suggest a restock draft, but this assistant is set to read-only, so I cannot record stock changes yet.",
      write_adjustment:
        "I can suggest a stock correction draft, but this assistant is set to read-only, so I cannot apply it yet.",
    }[input.writeTask]

    return {
      task: input.writeTask,
      response: guidance,
      actions: [
        "Open AI settings",
        "Switch to confirm writes",
        "Switch to full access",
      ],
      data: {},
    }
  }

  private async executeWriteTask(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
    writeTask: AssistantWriteTask
  }): Promise<AssistantResponse> {
    const products = await listNormalizedProducts(this.req, { shopId: input.shopId })
    const matchedProduct = this.matchProduct(input.query, products)

    switch (input.writeTask) {
      case "write_store": {
        const draft = await this.draftCreateStore(input)
        return this.executeCreateStore(
          input,
          (draft.tool_request?.payload ??
            draft.data.draft ??
            {}) as Record<string, unknown>
        )
      }
      case "write_product": {
        const draft = await this.draftCreateProduct(input)
        return this.executeCreateProduct(
          input,
          (draft.tool_request?.payload ??
            draft.data.draft ??
            {}) as Record<string, unknown>
        )
      }
      case "write_restock": {
        if (!matchedProduct) {
          return this.handleWriteTask(input)
        }
        const draft = await this.draftCreateRestock(input, matchedProduct)
        return this.executeCreateRestock(
          input,
          (draft.tool_request?.payload ??
            draft.data.draft ??
            {}) as Record<string, unknown>
        )
      }
      case "write_adjustment": {
        if (!matchedProduct) {
          return this.handleWriteTask(input)
        }
        const draft = await this.draftAdjustStock(input, matchedProduct)
        return this.executeAdjustStock(
          input,
          (draft.tool_request?.payload ??
            draft.data.draft ??
            {}) as Record<string, unknown>
        )
      }
      default:
        return this.handleGeneral(input)
    }
  }

  private async executeConfirmedAction(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    confirmedAction: AssistantConfirmedAction
  ): Promise<AssistantResponse> {
    switch (confirmedAction.kind) {
      case "create_store":
        return this.executeCreateStore(input, confirmedAction.payload)
      case "create_product":
        return this.executeCreateProduct(input, confirmedAction.payload)
      case "create_restock":
        return this.executeCreateRestock(input, confirmedAction.payload)
      case "adjust_stock":
        return this.executeAdjustStock(input, confirmedAction.payload)
      default:
        return this.handleGeneral(input)
    }
  }

  private async draftCreateProduct(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const fallbackPayload = this.normalizeProductDraft({
      name: input.query,
      purchase_unit: "Unit",
      purchase_value: 1,
      cost_per_purchase: 1,
      low_stock_threshold: 10,
      is_active: true,
      selling_units: [
        {
          unit: "piece",
          price: 0,
          conversion_value: 1,
        },
      ],
    })

    const extracted = await this.aiService.generateJson<Record<string, unknown>>(
      {
        shopId: input.shopId,
        operationType: "assistant_write_product",
        model: input.model,
        maxTokens: 180,
        temperature: 0.2,
        systemPrompt: loadPrompt(
          "ai/shop-assistant-product-draft.md",
          [
            "Extract a minimal product creation draft from the request.",
            "Return JSON only with keys name, category, purchase_unit, purchase_value, cost_per_purchase, low_stock_threshold, brand, size, color, model_name, is_active, selling_units.",
          ].join(" ")
        ),
        prompt: renderPrompt(
          [
            "Shop name: {{shop_name}}",
            "User request: {{query}}",
            "Draft the best possible product payload for a confirmation step.",
            "Return JSON only.",
          ].join("\n"),
          {
            shop_name: input.shopName,
            query: input.query,
          }
        ),
      },
      fallbackPayload
    )

    const draftPayload = this.normalizeProductDraft({
      ...fallbackPayload,
      ...extracted,
    })
    const planned = await this.planToolRequest({
      shopId: input.shopId,
      shopName: input.shopName,
      query: input.query,
      model: input.model,
      kind: "create_product",
      fallbackTitle: `Create product draft for ${String(draftPayload.name ?? "new item")}`,
      fallbackSummary: `I prepared a product draft for ${String(
        draftPayload.name ?? "the item"
      )}. Confirm to create it.`,
      fallbackPayload: draftPayload,
    })

    return {
      task: "write_product",
      response: planned.summary,
      actions: ["Open product form", "Open sales", "Cancel"],
      data: {
        draft: draftPayload,
      },
      tool_request: planned,
      requires_confirmation: true,
    }
  }

  private async draftCreateStore(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }): Promise<AssistantResponse> {
    const fallbackPayload = {
      theme_name: "smart-modern",
      color_description: "calm blue with clean white surfaces",
      tagline_hint: input.shopName,
      hero_title: `${input.shopName} online`,
      hero_subtitle: "Order products online with real-time stock visibility.",
      seo_description: `Buy from ${input.shopName} online on Trace.`,
      sharing_message: `Browse ${input.shopName} online.`,
      selected_product_ids: [] as string[],
      section_keys: ["featured_products", "mpesa_checkout", "chat_support"],
      store_slug: input.shopName,
      use_ai_copy: true,
      visual_style: "clean retail editorial",
      layout_notes: "simple hero, featured catalog, trust section, and contact footer",
      trust_signals: ["business contact", "secure checkout", "returns guidance"],
      security_notes: ["HTTPS-only links", "no custom scripts", "plain-language policies"],
      seo_keywords: ["online shop", "M-Pesa checkout", "local delivery"],
      cta_style: "order on WhatsApp",
      palette_notes: "blue and white with a calm local retail feel",
      site_brief: {
        audience: "local shoppers",
        tone: "clear and practical",
      },
    }

    const extracted = await this.aiService.generateJson<Record<string, unknown>>(
      {
        shopId: input.shopId,
        operationType: "assistant_write_store",
        model: input.model,
        maxTokens: 260,
        temperature: 0.2,
        systemPrompt: loadPrompt(
          "ai/shop-assistant-store-draft.md",
          [
            "Extract a storefront draft for the shop owner.",
            "Return JSON only with keys theme_name, color_description, tagline_hint, hero_title, hero_subtitle, seo_description, sharing_message, selected_product_ids, section_keys, store_slug, use_ai_copy, site_brief, trust_signals, security_notes, visual_style, layout_notes, seo_keywords, cta_style, palette_notes, accent_color.",
          ].join(" ")
        ),
        prompt: renderPrompt(
          [
            "Shop name: {{shop_name}}",
            "User request: {{query}}",
            "Draft the best possible storefront payload for a confirmation step.",
            "Return JSON only.",
          ].join("\n"),
          {
            shop_name: input.shopName,
            query: input.query,
          }
        ),
      },
      fallbackPayload
    )

    const draftPayload = {
      ...fallbackPayload,
      ...extracted,
      selected_product_ids: Array.isArray(extracted.selected_product_ids)
        ? extracted.selected_product_ids.map((item) => String(item))
        : fallbackPayload.selected_product_ids,
      section_keys: Array.isArray(extracted.section_keys)
        ? extracted.section_keys.map((item) => String(item))
        : fallbackPayload.section_keys,
      trust_signals: Array.isArray(extracted.trust_signals)
        ? extracted.trust_signals.map((item) => String(item))
        : fallbackPayload.trust_signals,
      security_notes: Array.isArray(extracted.security_notes)
        ? extracted.security_notes.map((item) => String(item))
        : fallbackPayload.security_notes,
      seo_keywords: Array.isArray(extracted.seo_keywords)
        ? extracted.seo_keywords.map((item) => String(item))
        : fallbackPayload.seo_keywords,
    }

    const planned = await this.planToolRequest({
      shopId: input.shopId,
      shopName: input.shopName,
      query: input.query,
      model: input.model,
      kind: "create_store",
      fallbackTitle: `Create storefront draft for ${input.shopName}`,
      fallbackSummary:
        "I prepared a storefront draft. Confirm to publish the store.",
      fallbackPayload: draftPayload,
    })

    return {
      task: "write_store",
      response: planned.summary,
      actions: ["Open online store builder", "Open reports", "Cancel"],
      data: {
        draft: draftPayload,
      },
      tool_request: planned,
      requires_confirmation: true,
    }
  }

  async generateStoreDraft(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
  }) {
    const fallbackPayload = {
      theme_name: "smart-modern",
      color_description: "calm blue with clean white surfaces",
      tagline_hint: input.shopName,
      hero_title: `${input.shopName} online`,
      hero_subtitle: "Order products online with real-time stock visibility.",
      seo_description: `Buy from ${input.shopName} online on Trace.`,
      sharing_message: `Browse ${input.shopName} online.`,
      selected_product_ids: [] as string[],
      section_keys: ["featured_products", "mpesa_checkout", "chat_support"],
      store_slug: input.shopName,
      use_ai_copy: true,
      visual_style: "clean retail editorial",
      layout_notes: "simple hero, featured catalog, trust section, and contact footer",
      trust_signals: ["business contact", "secure checkout", "returns guidance"],
      security_notes: ["HTTPS-only links", "no custom scripts", "plain-language policies"],
      seo_keywords: ["online shop", "M-Pesa checkout", "local delivery"],
      cta_style: "order on WhatsApp",
      palette_notes: "blue and white with a calm local retail feel",
      site_brief: {
        audience: "local shoppers",
        tone: "clear and practical",
      },
    }

    const extracted = await this.aiService.generateJson<Record<string, unknown>>(
      {
        shopId: input.shopId,
        operationType: "store_generation",
        model: input.model,
        maxTokens: 300,
        temperature: 0.2,
        systemPrompt: loadPrompt(
          "ai/shop-assistant-store-draft.md",
          [
            "Extract storefront copy and structure for the shop owner.",
            "Return JSON only with keys theme_name, color_description, tagline_hint, hero_title, hero_subtitle, seo_description, sharing_message, selected_product_ids, section_keys, store_slug, use_ai_copy, site_brief, trust_signals, security_notes, visual_style, layout_notes, seo_keywords, cta_style, palette_notes, accent_color.",
          ].join(" ")
        ),
        prompt: renderPrompt(
          [
            "Shop name: {{shop_name}}",
            "User request: {{query}}",
            "Return a storefront draft only.",
          ].join("\n"),
          {
            shop_name: input.shopName,
            query: input.query,
          }
        ),
      },
      fallbackPayload
    )

    return {
      ...fallbackPayload,
      ...extracted,
      selected_product_ids: Array.isArray(extracted.selected_product_ids)
        ? extracted.selected_product_ids.map((item) => String(item))
        : fallbackPayload.selected_product_ids,
      section_keys: Array.isArray(extracted.section_keys)
        ? extracted.section_keys.map((item) => String(item))
        : fallbackPayload.section_keys,
      trust_signals: Array.isArray(extracted.trust_signals)
        ? extracted.trust_signals.map((item) => String(item))
        : fallbackPayload.trust_signals,
      security_notes: Array.isArray(extracted.security_notes)
        ? extracted.security_notes.map((item) => String(item))
        : fallbackPayload.security_notes,
      seo_keywords: Array.isArray(extracted.seo_keywords)
        ? extracted.seo_keywords.map((item) => String(item))
        : fallbackPayload.seo_keywords,
    }
  }

  private async draftCreateRestock(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    matchedProduct: Awaited<ReturnType<typeof listNormalizedProducts>>[number] | null
  ): Promise<AssistantResponse> {
    if (!matchedProduct) {
      return {
        task: "write_restock",
        response:
          "I could not identify the product to restock. Open restock entry or refine the product name.",
        actions: ["Open restock entry", "Check low stock", "Open sales"],
        data: {},
      }
    }

    const draftPayload = this.normalizeRestockDraft({
      shop_id: input.shopId,
      location_id: matchedProduct.location_id ?? null,
      variant_id: matchedProduct.variant_id,
      quantity_received: this.extractQuantity(input.query) ?? 1,
      purchase_unit_qty: this.extractQuantity(input.query) ?? 1,
      cost_per_unit:
        matchedProduct.cost_per_purchase ??
        (matchedProduct.purchase_value ? matchedProduct.purchase_value : 0),
      total_cost:
        (matchedProduct.cost_per_purchase ??
          (matchedProduct.purchase_value ? matchedProduct.purchase_value : 0)) *
        (this.extractQuantity(input.query) ?? 1),
      source: input.query.toLowerCase().includes("receipt") ? "receipt_scan" : "manual",
      receipt_image_url: null,
      receipt_raw_text: input.query,
      supplier_name: null,
      sales_channel: "pos",
      size: matchedProduct.size,
      color: matchedProduct.color,
      imei_list: matchedProduct.imei ? [matchedProduct.imei] : null,
      model_name: matchedProduct.model_name,
      conversion_snapshot: {
        inventory_type: matchedProduct.inventory_type,
        purchase_unit: matchedProduct.purchase_unit,
        purchase_value: matchedProduct.purchase_value,
        selling_units: matchedProduct.selling_units,
      },
      timestamp: new Date().toISOString(),
      matched_product_name: matchedProduct.name,
    })

    const planned = await this.planToolRequest({
      shopId: input.shopId,
      shopName: input.shopName,
      query: input.query,
      model: input.model,
      kind: "create_restock",
      fallbackTitle: `Record restock for ${matchedProduct.name}`,
      fallbackSummary: `I prepared a restock draft for ${matchedProduct.name}. Confirm to record it.`,
      fallbackPayload: draftPayload,
    })

    return {
      task: "write_restock",
      response: planned.summary,
      actions: ["Open restock history", "Open reports", "Check low stock"],
      data: {
        draft: draftPayload,
      },
      tool_request: planned,
      requires_confirmation: true,
    }
  }

  private async draftAdjustStock(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    matchedProduct: Awaited<ReturnType<typeof listNormalizedProducts>>[number] | null
  ): Promise<AssistantResponse> {
    if (!matchedProduct) {
      return {
        task: "write_adjustment",
        response:
          "I could not identify the product to adjust. Open stock history or refine the product name.",
        actions: ["Open stock history", "Open sales", "Check low stock"],
        data: {},
      }
    }

    const quantity = this.extractQuantity(input.query) ?? 1
    const adjustmentType = this.detectAdjustmentType(input.query)
    const currentStock = matchedProduct.stock_remaining
    const nextStock =
      adjustmentType === "sale"
        ? Math.max(0, currentStock - quantity)
        : adjustmentType === "restock"
          ? currentStock + quantity
          : currentStock

    const draftPayload = this.normalizeAdjustmentDraft({
      adjustment_type: adjustmentType,
      quantity,
      reason: input.query,
      shop_id: input.shopId,
      location_id: matchedProduct.location_id ?? null,
      variant_id: matchedProduct.variant_id,
      matched_product_name: matchedProduct.name,
      current_stock: currentStock,
      next_stock: nextStock,
    })

    const planned = await this.planToolRequest({
      shopId: input.shopId,
      shopName: input.shopName,
      query: input.query,
      model: input.model,
      kind: "adjust_stock",
      fallbackTitle: `Adjust stock for ${matchedProduct.name}`,
      fallbackSummary: `I prepared a stock adjustment draft for ${matchedProduct.name}. Confirm to record it.`,
      fallbackPayload: draftPayload,
    })

    return {
      task: "write_adjustment",
      response: planned.summary,
      actions: ["Open stock history", "Open reports", "Check low stock"],
      data: {
        draft: draftPayload,
      },
      tool_request: planned,
      requires_confirmation: true,
    }
  }

  private async executeCreateProduct(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    payload: Record<string, unknown>
  ): Promise<AssistantResponse> {
    const normalized = this.normalizeProductDraft(payload)
    const result: any = await this.invokeRoute(adminCreateProduct, {
      body: normalized,
    })

    return {
      task: "write_product",
      response:
        (result?.product?.name as string | undefined)
          ? `Created product ${String(result.product.name)}.`
          : `Created a product draft for ${String(normalized.name ?? "the item")}.`,
      actions: ["Open sales", "Open reports", "Check low stock"],
      data: {
        product: result?.product ?? normalized,
      },
    }
  }

  private async executeCreateStore(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    payload: Record<string, unknown>
  ): Promise<AssistantResponse> {
    const draft = {
      theme_name: String(payload.theme_name ?? "smart-modern"),
      color_seed: this.optionalString(payload.color_seed) ?? "#195E86",
      tagline_hint: this.optionalString(payload.tagline_hint),
      hero_title: this.optionalString(payload.hero_title),
      hero_subtitle: this.optionalString(payload.hero_subtitle),
      seo_description: this.optionalString(payload.seo_description),
      sharing_message: this.optionalString(payload.sharing_message),
      selected_product_ids: Array.isArray(payload.selected_product_ids)
        ? payload.selected_product_ids.map((item) => String(item))
        : [],
      section_keys: Array.isArray(payload.section_keys)
        ? payload.section_keys.map((item) => String(item))
        : ["featured_products", "mpesa_checkout", "chat_support"],
      store_slug: this.optionalString(payload.store_slug),
      use_ai_copy: payload.use_ai_copy !== false,
    }

    const { POST: createStore } = await import(
      "../api/pos/stores/create/route.js"
    )
    const result = await this.invokeRoute(createStore, { body: draft })

    return {
      task: "write_store",
      response:
        result?.store?.public_url != null
          ? `Published the storefront for ${input.shopName}.`
          : `Published the storefront draft for ${input.shopName}.`,
      actions: ["Open online store builder", "Open reports", "Open sales"],
      data: {
        store: result?.store ?? draft,
      },
    }
  }

  private async executeCreateRestock(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    payload: Record<string, unknown>
  ): Promise<AssistantResponse> {
    const normalized = this.normalizeRestockDraft(payload)
    const {
      matched_product_name: _matchedProductName,
      ...routePayload
    } = normalized as typeof normalized & {
      matched_product_name?: string | null
    }
    const result: any = await this.invokeRoute(adminCreateRestock, {
      validatedBody: routePayload,
    })

    return {
      task: "write_restock",
      response:
        result?.restock?.id != null
          ? `Recorded a restock for ${String(normalized.matched_product_name ?? "the product")}.`
          : `Recorded a restock for ${String(normalized.matched_product_name ?? "the product")}.`,
      actions: ["Open restock history", "Open reports", "Check low stock"],
      data: {
        restock: result?.restock ?? routePayload,
      },
    }
  }

  private async executeAdjustStock(
    input: {
      shopId: string
      shopName: string
      query: string
      model?: string
    },
    payload: Record<string, unknown>
  ): Promise<AssistantResponse> {
    const normalized = this.normalizeAdjustmentDraft(payload)
    const {
      matched_product_name: _matchedProductName,
      current_stock: _currentStock,
      next_stock: _nextStock,
      ...routePayload
    } = normalized as typeof normalized & {
      matched_product_name?: string | null
      current_stock?: number
      next_stock?: number
    }
    const routeReq = this.req as MedusaRequest & { params?: Record<string, string> }
    routeReq.params = {
      ...(routeReq.params ?? {}),
      id: String(normalized.variant_id ?? ""),
    }
    const result: any = await this.invokeRoute(
      adminAdjustStock,
      {
        body: routePayload,
      },
      routeReq
    )

    return {
      task: "write_adjustment",
      response:
        String(normalized.adjustment_type ?? "").toLowerCase() === "sale"
          ? `Recorded a sale-style stock adjustment for ${String(
              normalized.matched_product_name ?? "the product"
            )}.`
          : `Recorded a stock adjustment for ${String(
              normalized.matched_product_name ?? "the product"
            )}.`,
      actions: ["Open stock history", "Open reports", "Check low stock"],
      data: {
        adjustment: result?.adjustment ?? routePayload,
        next_stock: normalized.next_stock,
      },
    }
  }

  private async planToolRequest(input: {
    shopId: string
    shopName: string
    query: string
    model?: string
    kind: AssistantToolKind
    fallbackTitle: string
    fallbackSummary: string
    fallbackPayload: Record<string, unknown>
  }): Promise<AssistantToolRequest> {
    const promptTemplate = loadPrompt(
      "ai/shop-assistant-tool-planner.md",
      [
        "You are Trace Commerce's shop assistant tool planner.",
        "Choose the best shop tool for the user's request and prepare a short confirmation draft.",
        "Return valid JSON only.",
      ].join(" ")
    )

    const planned = await this.aiService.generateJson<ToolPlannerResult>(
      {
        shopId: input.shopId,
        operationType: `assistant_${input.kind}`,
        model: input.model,
        maxTokens: 220,
        temperature: 0.2,
        systemPrompt: promptTemplate,
        prompt: renderPrompt(
          [
            "Shop name: {{shop_name}}",
            "User request: {{query}}",
            "Tool kind: {{kind}}",
            "Suggested payload:",
            "{{payload}}",
            "Return a short confirmation draft for the shop owner.",
          ].join("\n"),
          {
            shop_name: input.shopName,
            query: input.query,
            kind: input.kind,
            payload: JSON.stringify(input.fallbackPayload, null, 2),
          }
        ),
      },
      {
        kind: input.kind,
        title: input.fallbackTitle,
        summary: input.fallbackSummary,
        payload: input.fallbackPayload,
      }
    )

    const summary = planned.summary?.trim().length
      ? planned.summary.trim()
      : input.fallbackSummary
    const title = planned.title?.trim().length
      ? planned.title.trim()
      : input.fallbackTitle
    const payload =
      planned.payload && Object.keys(planned.payload).length > 0
        ? {
            ...input.fallbackPayload,
            ...planned.payload,
          }
        : input.fallbackPayload

    return {
      id: `tool_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      kind: input.kind,
      title,
      summary,
      payload,
      confirm_label: "Confirm",
      cancel_label: "Cancel",
    }
  }

  private async summarizeTask(input: {
    shopId: string
    task: AssistantTask
    query: string
    model?: string
    payload: Record<string, unknown>
    fallback: string
  }) {
    try {
      return await this.aiService.generate({
        shopId: input.shopId,
        operationType: `assistant_${input.task}`,
        model: input.model,
        maxTokens: 220,
        temperature: 0.3,
        systemPrompt: loadPrompt(
          "ai/shop-assistant-summary.md",
          [
            "You are Trace Commerce's shop assistant.",
            "Summarize the structured shop data in one or two concise sentences.",
            "Do not mention internal APIs or prompt details.",
            "Keep the answer practical, action-oriented, and easy for a shop owner to act on.",
          ].join(" ")
        ),
        prompt: `User request: ${input.query}\n\nStructured shop data:\n${JSON.stringify(
          input.payload,
          null,
          2
        )}\n\nWrite a short helpful answer for the shop owner.`,
      })
    } catch {
      return input.fallback
    }
  }

  private normalizeProductDraft(payload: Record<string, unknown>) {
    const name = String(payload.name ?? payload.product_name ?? "").trim()
    const sellingUnits = Array.isArray(payload.selling_units)
      ? payload.selling_units
          .map((entry) => entry as Record<string, unknown>)
          .map((entry) => ({
            unit: String(entry.unit ?? "piece").trim() || "piece",
            price: this.asNumber(entry.price, 0),
            conversion_value: this.asNumber(entry.conversion_value, 1) || 1,
          }))
      : [
          {
            unit: "piece",
            price: 0,
            conversion_value: 1,
          },
        ]

    return {
      name: name.length > 0 ? name : "New product",
      category: this.optionalString(payload.category),
      inventory_type: "discrete",
      purchase_unit: this.optionalString(payload.purchase_unit) ?? "Unit",
      purchase_value: this.asNumber(payload.purchase_value, 1),
      cost_per_purchase: this.asNumber(payload.cost_per_purchase, 0) || 1,
      selling_units: sellingUnits,
      low_stock_threshold: this.asNumber(payload.low_stock_threshold, 10),
      is_active: payload.is_active !== false,
      stock_remaining: this.asNumber(payload.stock_remaining, 0),
      brand: this.optionalString(payload.brand),
      size: this.optionalString(payload.size),
      color: this.optionalString(payload.color),
      model_name: this.optionalString(payload.model_name),
      is_returnable: true,
      return_window_days: 7,
    }
  }

  private normalizeRestockDraft(payload: Record<string, unknown>) {
    return {
      shop_id: String(payload.shop_id ?? ""),
      location_id: this.optionalString(payload.location_id) ?? undefined,
      variant_id: String(payload.variant_id ?? ""),
      quantity_received: this.asNumber(payload.quantity_received, 1) || 1,
      purchase_unit_qty: this.asNumber(payload.purchase_unit_qty, 1) || 1,
      cost_per_unit: this.asNumber(payload.cost_per_unit, 0),
      total_cost: this.asNumber(payload.total_cost, 0),
      source: String(payload.source ?? "manual"),
      receipt_image_url:
        payload.receipt_image_url == null
          ? null
          : String(payload.receipt_image_url),
      receipt_raw_text: String(payload.receipt_raw_text ?? ""),
      supplier_name:
        payload.supplier_name == null ? null : this.optionalString(payload.supplier_name),
      sales_channel: String(payload.sales_channel ?? "pos"),
      size: this.optionalString(payload.size),
      color: this.optionalString(payload.color),
      imei_list: Array.isArray(payload.imei_list)
        ? payload.imei_list.map((item) => String(item))
        : null,
      model_name: this.optionalString(payload.model_name),
      conversion_snapshot: (payload.conversion_snapshot ??
        {}) as Record<string, unknown>,
      timestamp:
        payload.timestamp instanceof Date
          ? payload.timestamp
          : new Date(String(payload.timestamp ?? new Date().toISOString())),
      matched_product_name: this.optionalString(payload.matched_product_name),
    }
  }

  private normalizeAdjustmentDraft(payload: Record<string, unknown>) {
    return {
      adjustment_type: String(payload.adjustment_type ?? "correction"),
      quantity: this.asNumber(payload.quantity, 1) || 1,
      reason: String(payload.reason ?? ""),
      shop_id: String(payload.shop_id ?? ""),
      location_id: this.optionalString(payload.location_id) ?? undefined,
      variant_id: String(payload.variant_id ?? ""),
      matched_product_name: this.optionalString(payload.matched_product_name),
      current_stock: this.asNumber(payload.current_stock, 0),
      next_stock: this.asNumber(payload.next_stock, 0),
    }
  }

  private tokenize(text: string) {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  }

  private asNumber(value: unknown, fallback = 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  private optionalString(value: unknown) {
    const text = value == null ? "" : String(value).trim()
    return text.length > 0 ? text : null
  }

  private extractQuantity(text: string) {
    const matches = text.match(/\b(\d+)\b/g)
    if (!matches || matches.length === 0) {
      return null
    }
    return Math.max(1, Number(matches[0]))
  }

  private detectAdjustmentType(text: string) {
    const normalized = text.toLowerCase()
    if (normalized.includes("sale") || normalized.includes("sold")) {
      return "sale"
    }
    if (normalized.includes("restock") || normalized.includes("received")) {
      return "restock"
    }
    if (normalized.includes("wastage")) {
      return "wastage"
    }
    if (normalized.includes("theft")) {
      return "theft"
    }
    if (normalized.includes("expiry")) {
      return "expiry"
    }
    return "correction"
  }

  private matchProduct(
    query: string,
    products: Awaited<ReturnType<typeof listNormalizedProducts>>
  ) {
    const tokens = this.tokenize(query)
    if (tokens.length === 0) {
      return null
    }
    return (
      products.find((product) => {
        const haystack = [
          product.name,
          product.category ?? "",
          product.brand ?? "",
          product.style_code ?? "",
          product.model_name ?? "",
          product.serial_number ?? "",
          product.imei ?? "",
        ]
          .join(" ")
          .toLowerCase()
        return tokens.some((token) => haystack.includes(token))
      }) ?? null
    )
  }

  private async invokeRoute(
    handler: (req: MedusaRequest, res: unknown) => Promise<void> | void,
    payload: { body?: unknown; validatedBody?: unknown },
    reqOverride?: MedusaRequest & { params?: Record<string, string> }
  ): Promise<Record<string, any> | undefined> {
    const req = reqOverride ?? this.req
    if (payload.body !== undefined) {
      ;(req as MedusaRequest & { body?: unknown }).body = payload.body
    }
    if (payload.validatedBody !== undefined) {
      ;(req as MedusaRequest & { validatedBody?: unknown }).validatedBody =
        payload.validatedBody
    }

    const capture: { statusCode?: number; body?: unknown } = {}
    const res = {
      status(code: number) {
        capture.statusCode = code
        return this
      },
      json(body: unknown) {
        capture.body = body
        return this
      },
      send(body: unknown) {
        capture.body = body
        return this
      },
    } as never

    await handler(req, res)
    const body = capture.body as Record<string, any> | undefined
    return body
  }
}
