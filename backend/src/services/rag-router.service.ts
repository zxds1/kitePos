import type { MedusaContainer } from "@medusajs/framework/types"
import { AI_CONFIG_MODULE } from "../modules/ai-config"
import { SHOP_MODULE } from "../modules/shop"
import type AIConfigModuleService from "../modules/ai-config/service"
import type ShopModuleService from "../modules/shop/service"
import { RAGFlowService } from "./ragflow.service"
import { RAGPgvectorService } from "./rag-pgvector.service"

type RouteInput = {
  query: string
  shopId: string
  shopName?: string
  intent?: string | null
  model?: string
}

type UploadInput = {
  file: Buffer
  fileName: string
  shopId: string
  shopName?: string
  documentType: "receipt" | "invoice" | "catalog" | "policy"
}

export class RAGRouterService {
  private readonly pgvectorService: RAGPgvectorService

  constructor(private readonly scope: MedusaContainer) {
    this.pgvectorService = new RAGPgvectorService(scope)
  }

  async routeQuery(input: RouteInput) {
    const configService: AIConfigModuleService = this.scope.resolve(AI_CONFIG_MODULE)
    const shopService: ShopModuleService = this.scope.resolve(SHOP_MODULE)
    const [shopConfig] = await configService.listAiConfigs(
      { scope: "shop", shop_id: input.shopId },
      { take: 1, order: { updated_at: "DESC" } }
    )
    const [platformConfig] = shopConfig
      ? [null]
      : await configService.listAiConfigs(
          { scope: "platform" },
          { take: 1, order: { updated_at: "DESC" } }
        )
    const config = (shopConfig ?? platformConfig ?? {}) as Record<string, unknown>
    const intent = input.intent ?? this.classifyIntent(input.query)

    if (this.isDocumentIntent(intent) && config.ragflow_enabled !== false) {
      const [shop] = await shopService.listShops({ id: input.shopId }, { take: 1 })
      const ragflow = new RAGFlowService({
        baseUrl:
          config.ragflow_base_url == null
            ? process.env.RAGFLOW_BASE_URL
            : String(config.ragflow_base_url),
        apiKey:
          config.ragflow_api_key == null
            ? process.env.RAGFLOW_API_KEY ?? null
            : String(config.ragflow_api_key),
      })
      const knowledgeBaseId =
        String(config.ragflow_knowledge_base_id ?? "").trim() ||
        (await ragflow.getOrCreateKnowledgeBase(
          input.shopId,
          input.shopName ?? String((shop as Record<string, unknown> | undefined)?.shop_name ?? "Trace Shop")
        ))
      const result = await ragflow.query({
        query: input.query,
        knowledgeBaseId,
        shopId: input.shopId,
        topK: Number(config.max_context_items ?? 5),
        scoreThreshold: Number(config.similarity_threshold ?? 0.7),
      })

      return {
        response: result.response,
        sources: result.sources,
        tokensUsed: result.tokensUsed,
        costKes: result.costKes,
        source: "ragflow" as const,
        intent,
      }
    }

    const result = await this.pgvectorService.retrieveAndGenerate({
      query: input.query,
      shopId: input.shopId,
      entityTypes: this.mapIntentToEntityTypes(intent),
      maxContextItems: Number(config.max_context_items ?? 5),
      similarityThreshold: Number(config.similarity_threshold ?? 0.7),
      operationType: "rag_query",
      model: input.model?.trim() || undefined,
    })

    return {
      response: result.response,
      sources: result.retrievedContext,
      tokensUsed: result.tokensUsed,
      costKes: result.costKes,
      source: result.source,
      intent,
    }
  }

  async uploadDocument(input: UploadInput) {
    const configService: AIConfigModuleService = this.scope.resolve(AI_CONFIG_MODULE)
    const shopService: ShopModuleService = this.scope.resolve(SHOP_MODULE)
    const [shopConfig] = await configService.listAiConfigs(
      { scope: "shop", shop_id: input.shopId },
      { take: 1, order: { updated_at: "DESC" } }
    )
    const config = (shopConfig ?? {}) as Record<string, unknown>
    const [shop] = await shopService.listShops({ id: input.shopId }, { take: 1 })
    const ragflow = new RAGFlowService({
      baseUrl:
        config.ragflow_base_url == null
          ? process.env.RAGFLOW_BASE_URL
          : String(config.ragflow_base_url),
      apiKey:
        config.ragflow_api_key == null
          ? process.env.RAGFLOW_API_KEY ?? null
          : String(config.ragflow_api_key),
    })
    const knowledgeBaseId =
      String(config.ragflow_knowledge_base_id ?? "").trim() ||
      (await ragflow.getOrCreateKnowledgeBase(
        input.shopId,
        input.shopName ?? String((shop as Record<string, unknown> | undefined)?.shop_name ?? "Trace Shop")
      ))
    const result = await ragflow.uploadDocument({
      file: input.file,
      fileName: input.fileName,
      knowledgeBaseId,
      documentType: input.documentType,
      shopId: input.shopId,
    })

    if (shopConfig && knowledgeBaseId !== String(config.ragflow_knowledge_base_id ?? "")) {
      await configService.updateAiConfigs({
        selector: { id: String((shopConfig as Record<string, unknown>).id) },
        data: {
          ragflow_knowledge_base_id: knowledgeBaseId,
        },
      })
    }

    return result
  }

  async embedEntity(input: {
    entityType: string
    entityId: string
    shopId: string
    contentText: string
    contentMetadata?: Record<string, unknown> | null
  }) {
    try {
      return await this.pgvectorService.embedEntity(input)
    } catch (error) {
      const logger = this.scope.resolve("logger") as
        | { warn?: (message: string) => void; error?: (message: string) => void }
        | undefined
      const message = error instanceof Error ? error.message : String(error)

      logger?.warn?.(
        `RAG embedding skipped for ${input.entityType}:${input.entityId} in shop ${input.shopId} - ${message}`
      )
    }
  }

  async deleteEmbeddings(entityType: string, entityId: string, shopId: string) {
    try {
      return await this.pgvectorService.deleteEmbeddings(entityType, entityId, shopId)
    } catch (error) {
      const logger = this.scope.resolve("logger") as
        | { warn?: (message: string) => void; error?: (message: string) => void }
        | undefined
      const message = error instanceof Error ? error.message : String(error)

      logger?.warn?.(
        `RAG embedding delete skipped for ${entityType}:${entityId} in shop ${shopId} - ${message}`
      )
    }
  }

  private classifyIntent(query: string) {
    const normalized = query.toLowerCase()

    if (
      ["receipt", "invoice", "document", "pdf", "catalog", "supplier"].some((term) =>
        normalized.includes(term)
      )
    ) {
      return "document_query"
    }

    if (normalized.includes("order")) {
      return "order_status"
    }

    if (["stock", "available", "have", "price", "product", "item"].some((term) =>
      normalized.includes(term)
    )) {
      return "product_query"
    }

    if (["return", "refund", "policy"].some((term) => normalized.includes(term))) {
      return "policy"
    }

    return "faq"
  }

  private isDocumentIntent(intent: string) {
    return ["document_query", "receipt_query", "invoice_query", "catalog_query"].includes(
      intent
    )
  }

  private mapIntentToEntityTypes(intent: string) {
    switch (intent) {
      case "product_query":
      case "stock_check":
      case "pricing":
        return ["product"]
      case "order_status":
        return ["order"]
      case "policy":
        return ["policy"]
      default:
        return ["faq", "policy", "product"]
    }
  }
}
