import { randomUUID } from "node:crypto"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { AI_CONFIG_MODULE } from "../../../modules/ai-config"
import type AIConfigModuleService from "../../../modules/ai-config/service"

const AIConfigPayload = z.object({
  scope: z.enum(["platform", "shop"]).default("platform"),
  shop_id: z.string().trim().min(1).optional().nullable(),
  litellm_base_url: z.string().url().optional(),
  litellm_api_key: z.string().optional().nullable(),
  default_provider: z.string().trim().min(1).optional(),
  default_model: z.string().trim().min(1).optional(),
  assistant_access_level: z
    .enum(["read_only", "confirm_writes", "full_access"])
    .optional(),
  assistant_full_access: z.boolean().optional(),
  provider_options: z.array(z.string().trim().min(1)).optional(),
  model_options: z.array(z.string().trim().min(1)).optional(),
  fallback_models: z.array(z.string().trim().min(1)).optional(),
  max_tokens_per_request: z.coerce.number().int().min(50).max(4000).optional(),
  max_tokens_per_day: z.coerce.number().int().min(100).max(500000).optional(),
  max_cost_per_day: z.coerce.number().min(0).optional().nullable(),
  preferred_tier: z.enum(["budget", "balanced", "premium"]).optional(),
  intent_rules: z.record(z.any()).optional().nullable(),
  escalation_rules: z.record(z.any()).optional().nullable(),
  chatbot_enabled: z.boolean().optional(),
  chatbot_personality: z
    .enum(["friendly", "professional", "casual", "formal"])
    .optional(),
  chatbot_language: z.enum(["en", "sw", "both"]).optional(),
  chatbot_welcome_message: z.string().optional().nullable(),
  rag_enabled: z.boolean().optional(),
  ragflow_enabled: z.boolean().optional(),
  ragflow_base_url: z.string().url().optional().nullable(),
  ragflow_api_key: z.string().optional().nullable(),
  embedding_model: z.string().trim().min(1).optional(),
  similarity_threshold: z.coerce.number().min(0).max(1).optional(),
  max_context_items: z.coerce.number().int().min(1).max(20).optional(),
  embed_products: z.boolean().optional(),
  embed_orders: z.boolean().optional(),
  embed_policies: z.boolean().optional(),
  embed_faqs: z.boolean().optional(),
  upload_receipts: z.boolean().optional(),
  upload_invoices: z.boolean().optional(),
  upload_catalogs: z.boolean().optional(),
  auto_embed_on_create: z.boolean().optional(),
  auto_embed_on_update: z.boolean().optional(),
  batch_embed_interval_hours: z.coerce.number().int().min(1).max(168).optional(),
  cache_embeddings: z.boolean().optional(),
  cache_ttl_hours: z.coerce.number().int().min(1).max(168).optional(),
  max_embeddings_per_day: z.coerce.number().int().min(1).max(50000).optional(),
  recommendations_enabled: z.boolean().optional(),
  recommendations_algorithm: z.enum(["rules_only", "ai_only", "hybrid"]).optional(),
  recommendations_cache_hours: z.coerce.number().int().min(1).max(168).optional(),
  inventory_ai_enabled: z.boolean().optional(),
  pricing_ai_enabled: z.boolean().optional(),
  marketing_ai_enabled: z.boolean().optional(),
  analytics_ai_enabled: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

function shapeConfig(config: Record<string, unknown> | null) {
  if (!config) {
    return null
  }

  const fallbackModels = Array.isArray(config.fallback_models)
    ? config.fallback_models
    : config.fallback_models &&
          typeof config.fallback_models === "object" &&
          Array.isArray((config.fallback_models as Record<string, unknown>).values)
      ? ((config.fallback_models as Record<string, unknown>).values as unknown[])
      : []

  const assistantAccessLevel = resolveAssistantAccessLevel(config)
  return {
    id: config.id,
    scope: config.scope,
    shop_id: config.shop_id,
    litellm_base_url: config.litellm_base_url,
    default_provider: config.default_provider,
    default_model: config.default_model,
    provider_options: Array.isArray(config.provider_options)
      ? config.provider_options
      : config.provider_options &&
            typeof config.provider_options === "object" &&
            Array.isArray((config.provider_options as Record<string, unknown>).values)
        ? ((config.provider_options as Record<string, unknown>).values as unknown[])
        : [],
    model_options: Array.isArray(config.model_options)
      ? config.model_options
      : config.model_options &&
            typeof config.model_options === "object" &&
            Array.isArray((config.model_options as Record<string, unknown>).values)
        ? ((config.model_options as Record<string, unknown>).values as unknown[])
        : [],
    fallback_models: fallbackModels,
    max_tokens_per_request: Number(config.max_tokens_per_request ?? 500),
    max_tokens_per_day: Number(config.max_tokens_per_day ?? 10000),
    max_cost_per_day: Number(config.max_cost_per_day ?? 0),
    preferred_tier: config.preferred_tier,
    intent_rules: config.intent_rules ?? {},
    escalation_rules: config.escalation_rules ?? {},
    chatbot_enabled: config.chatbot_enabled === true,
    assistant_access_level: assistantAccessLevel,
    assistant_full_access: assistantAccessLevel === "full_access",
    chatbot_personality: config.chatbot_personality,
    chatbot_language: config.chatbot_language,
    chatbot_welcome_message: config.chatbot_welcome_message,
    rag_enabled: config.rag_enabled !== false,
    ragflow_enabled: config.ragflow_enabled === true,
    ragflow_base_url: config.ragflow_base_url ?? null,
    embedding_model: config.embedding_model ?? "text-embedding-3-small",
    similarity_threshold: Number(config.similarity_threshold ?? 0.7),
    max_context_items: Number(config.max_context_items ?? 5),
    embed_products: config.embed_products !== false,
    embed_orders: config.embed_orders === true,
    embed_policies: config.embed_policies !== false,
    embed_faqs: config.embed_faqs !== false,
    upload_receipts: config.upload_receipts !== false,
    upload_invoices: config.upload_invoices !== false,
    upload_catalogs: config.upload_catalogs === true,
    auto_embed_on_create: config.auto_embed_on_create !== false,
    auto_embed_on_update: config.auto_embed_on_update !== false,
    batch_embed_interval_hours: Number(config.batch_embed_interval_hours ?? 24),
    cache_embeddings: config.cache_embeddings !== false,
    cache_ttl_hours: Number(config.cache_ttl_hours ?? 24),
    max_embeddings_per_day: Number(config.max_embeddings_per_day ?? 1000),
    embeddings_today: Number(config.embeddings_today ?? 0),
    ragflow_knowledge_base_id: config.ragflow_knowledge_base_id ?? null,
    recommendations_enabled: config.recommendations_enabled !== false,
    recommendations_algorithm: config.recommendations_algorithm,
    recommendations_cache_hours: Number(config.recommendations_cache_hours ?? 24),
    inventory_ai_enabled: config.inventory_ai_enabled !== false,
    pricing_ai_enabled: config.pricing_ai_enabled !== false,
    marketing_ai_enabled: config.marketing_ai_enabled !== false,
    analytics_ai_enabled: config.analytics_ai_enabled !== false,
    total_tokens_used: Number(config.total_tokens_used ?? 0),
    total_cost: Number(config.total_cost ?? 0),
    last_reset_at: config.last_reset_at,
    is_active: config.is_active !== false,
    updated_at: config.updated_at,
  }
}

function resolveAssistantAccessLevel(config: Record<string, unknown> | null) {
  const level = config?.assistant_access_level?.toString().trim()
  if (
    level === "read_only" ||
    level === "confirm_writes" ||
    level === "full_access"
  ) {
    return level
  }
  if (config?.assistant_full_access === true) {
    return "full_access"
  }
  return "confirm_writes"
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: AIConfigModuleService = req.scope.resolve(AI_CONFIG_MODULE)
  const shopId =
    typeof req.query.shop_id === "string" ? req.query.shop_id.trim() : undefined
  const scope = shopId ? "shop" : "platform"

  const [config] = await service.listAiConfigs(
    {
      scope,
      ...(shopId ? { shop_id: shopId } : {}),
    },
    {
      take: 1,
      order: { updated_at: "DESC" },
    }
  )

  res.status(200).json({
    success: true,
    config: shapeConfig((config as Record<string, unknown> | undefined) ?? null),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AIConfigPayload.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid AI configuration payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: AIConfigModuleService = req.scope.resolve(AI_CONFIG_MODULE)
  const scope = parsed.data.scope
  const shopId = parsed.data.shop_id ?? null
  const [existing] = await service.listAiConfigs(
    {
      scope,
      ...(shopId ? { shop_id: shopId } : {}),
    },
    { take: 1, order: { updated_at: "DESC" } }
  )

  const payload = {
    ...parsed.data,
    provider_options: parsed.data.provider_options
      ? { values: parsed.data.provider_options }
      : undefined,
    model_options: parsed.data.model_options
      ? { values: parsed.data.model_options }
      : undefined,
    fallback_models: parsed.data.fallback_models
      ? { values: parsed.data.fallback_models }
      : undefined,
    id:
      (existing as Record<string, unknown> | undefined)?.id?.toString() ??
      `aic_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    scope,
    shop_id: scope === "shop" ? shopId : null,
    updated_at: new Date(),
  }

  const config = existing
    ? await service.updateAiConfigs({
        selector: { id: String((existing as Record<string, unknown>).id) },
        data: payload as Record<string, unknown>,
      })
    : (
        await service.createAiConfigs([payload as Record<string, unknown>])
      )[0]

  res.status(200).json({
    success: true,
    config: shapeConfig(config as Record<string, unknown>),
  })
}
