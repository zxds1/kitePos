import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { AI_CONFIG_MODULE } from "../modules/ai-config"
import type AIConfigModuleService from "../modules/ai-config/service"
import { AI_OPERATION_LOG_MODULE } from "../modules/ai-operation-log"
import type AIOperationLogModuleService from "../modules/ai-operation-log/service"
import { loadPrompt, renderPrompt } from "../utils/prompt-loader"

type AIConfigRecord = Record<string, unknown>

type GenerateInput = {
  prompt: string
  shopId: string
  operationType: string
  maxTokens?: number
  model?: string
  temperature?: number
  systemPrompt?: string
  metadata?: Record<string, unknown>
}

type GenerateResult = {
  content: string
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costKes: number
  latencyMs: number
}

const MODEL_PRICING_USD_PER_1K: Record<string, number> = {
  "gpt-3.5-turbo": 0.0015,
  "gpt-4o-mini": 0.0006,
  "gpt-4": 0.03,
  "claude-3-haiku": 0.00025,
  "claude-3-sonnet": 0.003,
  "gemini-1.5-flash": 0.0005,
  "gemini-pro": 0.0005,
}

const DEFAULT_FALLBACK_MODELS = [
  "gpt-4o-mini",
  "gpt-3.5-turbo",
  "claude-3-haiku",
  "gemini-1.5-flash",
]

export class AIService {
  constructor(private readonly scope: MedusaContainer) {}

  async generate(input: GenerateInput): Promise<string> {
    const result = await this.generateWithUsage(input)
    return result.content
  }

  async generateWithUsage(input: GenerateInput): Promise<GenerateResult> {
    const config = await this.resolveConfig(input.shopId)
    const maxTokens = Math.min(
      input.maxTokens ?? Number(config.max_tokens_per_request ?? 500),
      Number(config.max_tokens_per_request ?? 500)
    )
    await this.assertWithinBudget(config, input.shopId)

    const orderedModels = this.buildModelFallbacks(config, input.model)
    let lastError: Error | null = null

    for (const selectedModel of orderedModels) {
      const startedAt = Date.now()
      try {
        const response = await fetch(
          `${String(config.litellm_base_url ?? "http://localhost:4000")}/v1/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(config.litellm_api_key
                ? { Authorization: `Bearer ${String(config.litellm_api_key)}` }
                : {}),
            },
            body: JSON.stringify({
              model: selectedModel,
              messages: [
                {
                  role: "system",
                  content:
                    input.systemPrompt ??
                    this.defaultSystemPrompt(config),
                },
                {
                  role: "user",
                  content: input.prompt,
                },
              ],
              max_tokens: maxTokens,
              temperature: input.temperature ?? 0.4,
            }),
          }
        )

        if (!response.ok) {
          throw new Error(await response.text())
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string | null } | null }>
          usage?: {
            prompt_tokens?: number
            completion_tokens?: number
            total_tokens?: number
          }
        }
        const content = payload.choices?.[0]?.message?.content?.trim() ?? ""
        const usage = payload.usage ?? {}
        const totalTokens = Number(usage.total_tokens ?? 0)
        const costKes = this.calculateCostKes(totalTokens, selectedModel)
        const provider = this.extractProvider(selectedModel)
        const latencyMs = Date.now() - startedAt

        await this.logOperation({
          shopId: input.shopId,
          operationType: input.operationType,
          model: selectedModel,
          promptTokens: Number(usage.prompt_tokens ?? 0),
          completionTokens: Number(usage.completion_tokens ?? 0),
          totalTokens,
          costKes,
          latencyMs,
          success: true,
          requestExcerpt: input.prompt,
          responseExcerpt: content,
          metadata: input.metadata,
        })

        return {
          content,
          model: selectedModel,
          provider,
          promptTokens: Number(usage.prompt_tokens ?? 0),
          completionTokens: Number(usage.completion_tokens ?? 0),
          totalTokens,
          costKes,
          latencyMs,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        await this.logOperation({
          shopId: input.shopId,
          operationType: input.operationType,
          model: selectedModel,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costKes: 0,
          latencyMs: Date.now() - startedAt,
          success: false,
          errorMessage: lastError.message,
          requestExcerpt: input.prompt,
          metadata: input.metadata,
        })
      }
    }

    throw new Error(lastError?.message ?? "AI service unavailable")
  }

  async generateJson<T>(input: GenerateInput, fallback: T): Promise<T> {
    const prompt = `${input.prompt}\n\nReturn valid JSON only.`
    try {
      const content = await this.generate({
        ...input,
        prompt,
      })
      return JSON.parse(content) as T
    } catch {
      return fallback
    }
  }

  async resolveConfig(shopId?: string | null): Promise<AIConfigRecord> {
    const service: AIConfigModuleService = this.scope.resolve(AI_CONFIG_MODULE)

    if (shopId) {
      const [shopConfig] = await service.listAiConfigs(
        { scope: "shop", shop_id: shopId, is_active: true },
        { take: 1, order: { updated_at: "DESC" } }
      )
      if (shopConfig) {
        return shopConfig as AIConfigRecord
      }
    }

    const [platformConfig] = await service.listAiConfigs(
      { scope: "platform", is_active: true },
      { take: 1, order: { updated_at: "DESC" } }
    )

    if (platformConfig) {
      return platformConfig as AIConfigRecord
    }

    const [created] = await service.createAiConfigs([
      {
        id: `aic_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
        scope: "platform",
        shop_id: null,
        litellm_base_url:
          process.env.LITELLM_BASE_URL ?? "http://localhost:4000",
        litellm_api_key: process.env.LITELLM_API_KEY ?? null,
        default_provider: "openai",
        default_model: process.env.AI_DEFAULT_MODEL ?? "gpt-4o-mini",
        provider_options: { values: ["openai", "anthropic", "google", "azure", "local"] },
        model_options: { values: DEFAULT_FALLBACK_MODELS },
        fallback_models: { values: DEFAULT_FALLBACK_MODELS },
        preferred_tier: "budget",
        max_tokens_per_request: 500,
        max_tokens_per_day: 10000,
        max_cost_per_day: 50,
        chatbot_enabled: true,
        assistant_full_access: false,
        chatbot_personality: "friendly",
        chatbot_language: "both",
        rag_enabled: true,
        ragflow_enabled: false,
        ragflow_base_url: process.env.RAGFLOW_BASE_URL ?? "http://localhost:8080",
        ragflow_api_key: process.env.RAGFLOW_API_KEY ?? null,
        ragflow_knowledge_base_id: null,
        embedding_model:
          process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        embedding_dimensions: 1536,
        similarity_threshold: 0.7,
        max_context_items: 5,
        embed_products: true,
        embed_orders: false,
        embed_policies: true,
        embed_faqs: true,
        upload_receipts: true,
        upload_invoices: true,
        upload_catalogs: false,
        auto_embed_on_create: true,
        auto_embed_on_update: true,
        batch_embed_interval_hours: 24,
        cache_embeddings: true,
        cache_ttl_hours: 24,
        max_embeddings_per_day: 1000,
        embeddings_today: 0,
        recommendations_enabled: true,
        recommendations_algorithm: "hybrid",
        recommendations_cache_hours: 24,
        inventory_ai_enabled: true,
        pricing_ai_enabled: true,
        marketing_ai_enabled: true,
        analytics_ai_enabled: true,
        assistant_access_level: "confirm_writes",
        total_tokens_used: 0,
        total_cost: 0,
        last_reset_at: new Date(),
        is_active: true,
      },
    ])

    return created as unknown as AIConfigRecord
  }

  private defaultSystemPrompt(config: AIConfigRecord) {
    const personality = String(config.chatbot_personality ?? "friendly")
    const language = String(config.chatbot_language ?? "both")
    const languageInstruction =
      language === "sw"
        ? "Respond in Swahili."
        : language === "en"
          ? "Respond in English."
          : "Respond in either English or Swahili based on the prompt."
    return renderPrompt(
      loadPrompt(
        "ai/default-system-prompt.md",
        [
          "You are Flo, Storflo's AI assistant for Kenyan retail and wholesale shops.",
          "Use a {{personality}} tone.",
          "{{language_instruction}}",
          "Keep answers concise, accurate, and practical.",
        ].join(" ")
      ),
      {
        personality,
        language_instruction: languageInstruction,
      }
    )
  }

  private buildModelFallbacks(config: AIConfigRecord, requestedModel?: string) {
    const rawFallbacks = Array.isArray(config.fallback_models)
      ? config.fallback_models
      : config.fallback_models &&
            typeof config.fallback_models === "object" &&
            Array.isArray((config.fallback_models as Record<string, unknown>).values)
        ? ((config.fallback_models as Record<string, unknown>).values as unknown[])
        : []
    const parsedFallbacks = rawFallbacks
      .map((entry) => String(entry))
      .filter((entry) => entry.length > 0)
    const models = [
      requestedModel ?? String(config.default_model ?? "gpt-4o-mini"),
      ...parsedFallbacks,
      ...DEFAULT_FALLBACK_MODELS,
    ]

    return Array.from(new Set(models.filter((entry) => entry.length > 0)))
  }

  private calculateCostKes(tokens: number, model: string) {
    const usdPer1K = MODEL_PRICING_USD_PER_1K[model] ?? 0.001
    const costUsd = (tokens / 1000) * usdPer1K
    return Math.round(costUsd * 130 * 100) / 100
  }

  private extractProvider(model: string) {
    if (model.includes("gpt")) return "openai"
    if (model.includes("claude")) return "anthropic"
    if (model.includes("gemini")) return "google"
    if (model.includes("azure")) return "azure"
    return "local"
  }

  private async assertWithinBudget(config: AIConfigRecord, shopId: string) {
    const logsService: AIOperationLogModuleService = this.scope.resolve(
      AI_OPERATION_LOG_MODULE
    )
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const logs = (await logsService.listAiOperationLogs(
      { shop_id: shopId },
      { take: 500, order: { occurred_at: "DESC" } }
    )) as Array<Record<string, unknown>>

    const todayLogs = logs.filter((log) => {
      const occurredAt = new Date(String(log.occurred_at))
      return occurredAt >= startOfDay && occurredAt <= endOfDay
    })
    const tokenCount = todayLogs.reduce(
      (sum, log) => sum + Number(log.total_tokens ?? 0),
      0
    )
    const costKes = todayLogs.reduce(
      (sum, log) => sum + Number(log.cost_kes ?? 0),
      0
    )

    if (tokenCount >= Number(config.max_tokens_per_day ?? 10000)) {
      throw new Error("Daily AI token budget reached")
    }

    const maxCostPerDay = Number(config.max_cost_per_day ?? 0)
    if (maxCostPerDay > 0 && costKes >= maxCostPerDay) {
      throw new Error("Daily AI cost budget reached")
    }
  }

  private async logOperation(input: {
    shopId: string
    operationType: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    costKes: number
    latencyMs: number
    success: boolean
    errorMessage?: string
    requestExcerpt?: string
    responseExcerpt?: string
    metadata?: Record<string, unknown>
  }) {
    const logsService: AIOperationLogModuleService = this.scope.resolve(
      AI_OPERATION_LOG_MODULE
    )
    const configService: AIConfigModuleService = this.scope.resolve(AI_CONFIG_MODULE)

    await logsService.createAiOperationLogs({
      id: `ail_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shopId,
      operation_type: input.operationType,
      provider: this.extractProvider(input.model),
      model: input.model,
      prompt_tokens: input.promptTokens,
      completion_tokens: input.completionTokens,
      total_tokens: input.totalTokens,
      cost_kes: input.costKes,
      latency_ms: input.latencyMs,
      success: input.success,
      error_message: input.errorMessage ?? null,
      request_excerpt: input.requestExcerpt?.slice(0, 500) ?? null,
      response_excerpt: input.responseExcerpt?.slice(0, 500) ?? null,
      metadata: input.metadata ?? null,
      rag_source:
        input.metadata?.rag_source != null
          ? String(input.metadata.rag_source)
          : "llm",
      cache_hit: input.metadata?.cache_hit === true,
      cached: input.metadata?.cached === true,
      occurred_at: new Date(),
    })

    const config = await this.resolveConfig(input.shopId)
    await configService.updateAiConfigs({
      selector: { id: String(config.id) },
      data: {
        total_tokens_used:
          Number(config.total_tokens_used ?? 0) + input.totalTokens,
        total_cost: Number(config.total_cost ?? 0) + input.costKes,
      },
    })
  }
}
