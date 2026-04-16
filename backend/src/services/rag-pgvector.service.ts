import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AI_CONFIG_MODULE } from "../modules/ai-config"
import type AIConfigModuleService from "../modules/ai-config/service"
import { AIService } from "./ai.service"
import { EmbeddingService } from "./embedding.service"

type RetrieveInput = {
  query: string
  shopId: string
  entityTypes?: string[]
  maxContextItems?: number
  similarityThreshold?: number
  operationType: string
  model?: string
}

type EmbedInput = {
  entityType: string
  entityId: string
  shopId: string
  contentText: string
  contentMetadata?: Record<string, unknown> | null
}

export class RAGPgvectorService {
  private readonly aiService: AIService
  private readonly pgConnection: any

  constructor(private readonly scope: MedusaContainer) {
    this.aiService = new AIService(scope)
    this.pgConnection = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  }

  async retrieveAndGenerate(input: RetrieveInput) {
    const config = await this.aiService.resolveConfig(input.shopId)
    const embeddingService = new EmbeddingService({
      baseUrl: String(config.litellm_base_url ?? "http://localhost:4000"),
      apiKey:
        config.litellm_api_key == null ? null : String(config.litellm_api_key),
      model: String(config.embedding_model ?? "text-embedding-3-small"),
    })
    const queryEmbedding = await embeddingService.generateEmbedding(input.query)
    const entityTypes =
      input.entityTypes && input.entityTypes.length > 0
        ? input.entityTypes
        : ["product", "policy", "faq"]
    const threshold = Number(
      input.similarityThreshold ?? config.similarity_threshold ?? 0.7
    )
    const maxItems = Number(input.maxContextItems ?? config.max_context_items ?? 5)
    const retrieval = await this.retrieveContext({
      query: input.query,
      queryEmbedding,
      shopId: input.shopId,
      entityTypes,
      threshold,
      maxItems,
    })

    const rows = Array.isArray(retrieval.rows) ? retrieval.rows : retrieval
    const contextItems = Array.isArray(rows) ? rows : []

    if (contextItems.length > 0) {
      await this.pgConnection.raw(
        `
          update ai_embeddings
          set usage_count = usage_count + 1,
              last_used_at = now(),
              updated_at = updated_at
          where id in (${contextItems.map(() => "?").join(", ")})
        `,
        contextItems.map((item: Record<string, unknown>) => String(item.id))
      )
    }

    const aiResult = await this.aiService.generateWithUsage({
      shopId: input.shopId,
      operationType: input.operationType,
      prompt: this.buildPrompt(input.query, contextItems),
      maxTokens: 500,
      model: input.model,
      metadata: {
        rag_source: "pgvector",
        entity_types: entityTypes,
        context_count: contextItems.length,
      },
    })

    return {
      response: aiResult.content,
      retrievedContext: contextItems,
      tokensUsed:
        aiResult.totalTokens + embeddingService.estimateTokens(input.query),
      costKes:
        aiResult.costKes +
        embeddingService.calculateCostKes(
          embeddingService.estimateTokens(input.query)
        ),
      source: "pgvector" as const,
    }
  }

  async embedEntity(input: EmbedInput) {
    const configService: AIConfigModuleService = this.scope.resolve(AI_CONFIG_MODULE)
    if (!input.contentText.trim()) {
      await this.deleteEmbeddings(input.entityType, input.entityId, input.shopId)
      return
    }

    const config = await this.aiService.resolveConfig(input.shopId)
    if (config.rag_enabled === false) {
      return
    }
    if (input.entityType === "product" && config.embed_products === false) {
      return
    }
    if (input.entityType === "order" && config.embed_orders === false) {
      return
    }
    if (input.entityType === "policy" && config.embed_policies === false) {
      return
    }
    if (input.entityType === "faq" && config.embed_faqs === false) {
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const lastReset = String(config.last_reset_at ?? today).slice(0, 10)
    const embeddingsToday =
      lastReset === today ? Number(config.embeddings_today ?? 0) : 0

    if (embeddingsToday >= Number(config.max_embeddings_per_day ?? 1000)) {
      return
    }

    const embeddingService = new EmbeddingService({
      baseUrl: String(config.litellm_base_url ?? "http://localhost:4000"),
      apiKey:
        config.litellm_api_key == null ? null : String(config.litellm_api_key),
      model: String(config.embedding_model ?? "text-embedding-3-small"),
    })
    const embedding = await embeddingService.generateEmbedding(input.contentText)
    const embeddingId = this.buildEmbeddingId(
      input.entityType,
      input.entityId,
      input.shopId
    )

    if (await this.hasVectorColumn()) {
      const embeddingLiteral = `[${embedding.join(",")}]`
      await this.pgConnection.raw(
        `
          insert into ai_embeddings (
            id,
            entity_type,
            entity_id,
            shop_id,
            embedding,
            content_text,
            content_metadata,
            created_at,
            updated_at
          )
          values (?, ?, ?, ?, ?::vector, ?, ?::jsonb, now(), now())
          on conflict (id) do update set
            embedding = excluded.embedding,
            content_text = excluded.content_text,
            content_metadata = excluded.content_metadata,
            updated_at = now()
        `,
        [
          embeddingId,
          input.entityType,
          input.entityId,
          input.shopId,
          embeddingLiteral,
          input.contentText,
          JSON.stringify(input.contentMetadata ?? {}),
        ]
      )
    } else {
      await this.pgConnection.raw(
        `
          insert into ai_embeddings (
            id,
            entity_type,
            entity_id,
            shop_id,
            embedding_json,
            content_text,
            content_metadata,
            created_at,
            updated_at
          )
          values (?, ?, ?, ?, ?::jsonb, ?, ?::jsonb, now(), now())
          on conflict (id) do update set
            embedding_json = excluded.embedding_json,
            content_text = excluded.content_text,
            content_metadata = excluded.content_metadata,
            updated_at = now()
        `,
        [
          embeddingId,
          input.entityType,
          input.entityId,
          input.shopId,
          JSON.stringify(embedding),
          input.contentText,
          JSON.stringify(input.contentMetadata ?? {}),
        ]
      )
    }

    await configService.updateAiConfigs({
      selector: { id: String(config.id) },
      data: {
        embeddings_today: embeddingsToday + 1,
        last_reset_at: new Date(),
      },
    })
  }

  async deleteEmbeddings(entityType: string, entityId: string, shopId: string) {
    await this.pgConnection.raw(
      `
        delete from ai_embeddings
        where entity_type = ? and entity_id = ? and shop_id = ?
      `,
      [entityType, entityId, shopId]
    )
  }

  private buildEmbeddingId(entityType: string, entityId: string, shopId: string) {
    return `${entityType}_${entityId}_${shopId}`
  }

  private async retrieveContext(input: {
    query: string
    queryEmbedding: number[]
    shopId: string
    entityTypes: string[]
    threshold: number
    maxItems: number
  }) {
    const typePlaceholders = input.entityTypes.map(() => "?").join(", ")

    if (await this.hasVectorColumn()) {
      const embeddingLiteral = `[${input.queryEmbedding.join(",")}]`
      return this.pgConnection.raw(
        `
          select
            id,
            entity_type,
            entity_id,
            shop_id,
            content_text,
            content_metadata,
            1 - (embedding <=> ?::vector) as similarity
          from ai_embeddings
          where shop_id = ?
            and entity_type in (${typePlaceholders})
            and 1 - (embedding <=> ?::vector) >= ?
          order by embedding <=> ?::vector
          limit ?
        `,
        [
          embeddingLiteral,
          input.shopId,
          ...input.entityTypes,
          embeddingLiteral,
          input.threshold,
          embeddingLiteral,
          input.maxItems,
        ]
      )
    }

    const wildcardQuery = `%${input.query.trim().replace(/\s+/g, "%")}%`
    return this.pgConnection.raw(
      `
        select
          id,
          entity_type,
          entity_id,
          shop_id,
          content_text,
          content_metadata,
          case when lower(content_text) like lower(?) then 0.9 else 0.5 end as similarity
        from ai_embeddings
        where shop_id = ?
          and entity_type in (${typePlaceholders})
          and lower(content_text) like lower(?)
        order by usage_count desc, updated_at desc
        limit ?
      `,
      [
        wildcardQuery,
        input.shopId,
        ...input.entityTypes,
        wildcardQuery,
        input.maxItems,
      ]
    )
  }

  private async hasVectorColumn() {
    const result = await this.pgConnection.raw(
      `
        select 1
        from information_schema.columns
        where table_name = 'ai_embeddings'
          and column_name = 'embedding'
        limit 1
      `
    )

    const rows = Array.isArray(result.rows) ? result.rows : result
    return Array.isArray(rows) && rows.length > 0
  }

  private buildPrompt(query: string, contextItems: Array<Record<string, unknown>>) {
    const contextText = contextItems.length
      ? contextItems
          .map((item, index) =>
            [
              `Context ${index + 1}`,
              `Type: ${String(item.entity_type ?? "unknown")}`,
              `Content: ${String(item.content_text ?? "")}`,
              item.content_metadata
                ? `Metadata: ${JSON.stringify(item.content_metadata)}`
                : null,
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n")
      : "No shop-specific context was retrieved."

    return [
      "Answer using the retrieved Trace shop context when relevant.",
      "Be explicit when context is missing.",
      "Keep the answer concise and practical for a Kenyan retail business.",
      "",
      "Retrieved context:",
      contextText,
      "",
      `Question: ${query}`,
    ].join("\n")
  }
}
