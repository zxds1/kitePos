import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { AI_CONFIG_MODULE } from "../../../../modules/ai-config"
import type AIConfigModuleService from "../../../../modules/ai-config/service"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../auth/_utils/jwt"

const ShopAIConfigPayload = z.object({
  default_provider: z.string().trim().min(1).optional(),
  default_model: z.string().trim().min(1).optional(),
})

function extractModelOptions(config: Record<string, unknown> | null) {
  const configuredModelOptions = Array.isArray(config?.model_options)
    ? config?.model_options
    : config?.model_options &&
          typeof config.model_options === "object" &&
          Array.isArray((config.model_options as Record<string, unknown>).values)
      ? ((config.model_options as Record<string, unknown>).values as unknown[])
      : []
  if (configuredModelOptions.length > 0) {
    return configuredModelOptions
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0)
  }
  const fallbackModels = Array.isArray(config?.fallback_models)
    ? config?.fallback_models
    : config?.fallback_models &&
          typeof config.fallback_models === "object" &&
          Array.isArray((config.fallback_models as Record<string, unknown>).values)
        ? ((config.fallback_models as Record<string, unknown>).values as unknown[])
        : []
  return Array.from(
    new Set(
      [
    config?.default_model?.toString() ?? "gpt-4o-mini",
    ...fallbackModels.map((entry) => entry?.toString() ?? ""),
      ].filter((entry) => entry.length > 0)
    )
  )
}

function extractProviderOptions(
  modelOptions: string[],
  fallback?: string | null,
  config?: Record<string, unknown> | null
) {
  const configuredProviderOptions = Array.isArray(config?.provider_options)
    ? config.provider_options
    : config?.provider_options &&
          typeof config.provider_options === "object" &&
          Array.isArray((config.provider_options as Record<string, unknown>).values)
      ? ((config.provider_options as Record<string, unknown>).values as unknown[])
      : []
  if (configuredProviderOptions.length > 0) {
    return configuredProviderOptions
      .map((entry) => String(entry ?? "").trim())
      .filter((entry) => entry.length > 0)
  }
  const providers = new Set<string>()
  if (fallback != null && fallback.trim().length > 0) {
    providers.add(fallback.trim())
  }

  for (const model of modelOptions) {
    if (model.includes("gpt")) providers.add("openai")
    if (model.includes("claude")) providers.add("anthropic")
    if (model.includes("gemini")) providers.add("google")
    if (model.includes("azure")) providers.add("azure")
    if (model.includes("llama") || model.includes("ollama")) providers.add("local")
  }

  if (providers.size === 0) {
    providers.add("openai")
  }

  return Array.from(providers)
}

function shapeConfig(
  platformConfig: Record<string, unknown> | null,
  shopConfig: Record<string, unknown> | null
) {
  const modelOptions = extractModelOptions(platformConfig)
  const providerOptions = extractProviderOptions(
    modelOptions,
    platformConfig?.default_provider?.toString(),
    platformConfig
  )
  const selectedProvider =
    (shopConfig?.default_provider?.toString().trim().length ?? 0) > 0
      ? String(shopConfig?.default_provider)
      : platformConfig?.default_provider?.toString() ?? "openai"
  const selectedModel =
    (shopConfig?.default_model?.toString().trim().length ?? 0) > 0
      ? String(shopConfig?.default_model)
      : platformConfig?.default_model?.toString() ?? "gpt-4o-mini"
  return {
    default_provider: selectedProvider,
    default_model: selectedModel,
    provider_options: providerOptions,
    model_options: modelOptions,
    total_tokens_used: Number(shopConfig?.total_tokens_used ?? platformConfig?.total_tokens_used ?? 0),
    total_cost: Number(shopConfig?.total_cost ?? platformConfig?.total_cost ?? 0),
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const service: AIConfigModuleService = req.scope.resolve(AI_CONFIG_MODULE)
  const [shopConfig] = await service.listAiConfigs(
    { scope: "shop", shop_id: auth.shop_id },
    { take: 1, order: { updated_at: "DESC" } }
  )
  const [platformConfig] = await service.listAiConfigs(
    { scope: "platform", is_active: true },
    { take: 1, order: { updated_at: "DESC" } }
  )

  res.status(200).json({
    success: true,
    config: shapeConfig(
      (platformConfig as Record<string, unknown> | undefined) ?? null,
      (shopConfig as Record<string, unknown> | undefined) ?? null
    ),
  })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  if (auth.role !== "owner" && auth.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Only shop owners and admins can update AI settings",
    })
    return
  }

  const parsed = ShopAIConfigPayload.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid AI configuration payload",
      errors: parsed.error.flatten(),
    })
    return
  }

  const service: AIConfigModuleService = req.scope.resolve(AI_CONFIG_MODULE)
  const [platformConfig] = await service.listAiConfigs(
    { scope: "platform", is_active: true },
    { take: 1, order: { updated_at: "DESC" } }
  )
  const [existing] = await service.listAiConfigs(
    { scope: "shop", shop_id: auth.shop_id },
    { take: 1, order: { updated_at: "DESC" } }
  )
  const platform = (platformConfig as Record<string, unknown> | undefined) ?? null
  const modelOptions = extractModelOptions(platform)
  const providerOptions = extractProviderOptions(
    modelOptions,
    platform?.default_provider?.toString()
  )

  if (
    parsed.data.default_model &&
    !modelOptions.includes(parsed.data.default_model)
  ) {
    res.status(400).json({
      success: false,
      message: "Selected model is not allowed by the admin configuration",
    })
    return
  }

  if (
    parsed.data.default_provider &&
    !providerOptions.includes(parsed.data.default_provider)
  ) {
    res.status(400).json({
      success: false,
      message: "Selected provider is not allowed by the admin configuration",
    })
    return
  }

  const payload = {
    ...(existing as Record<string, unknown> | undefined),
    scope: "shop",
    shop_id: auth.shop_id,
    default_provider:
      parsed.data.default_provider ??
      (existing as Record<string, unknown> | undefined)?.default_provider ??
      platform?.default_provider ??
      "openai",
    default_model:
      parsed.data.default_model ??
      (existing as Record<string, unknown> | undefined)?.default_model ??
      platform?.default_model ??
      "gpt-4o-mini",
    updated_at: new Date(),
  }

  const config = existing
    ? await service.updateAiConfigs({
        selector: { id: String((existing as Record<string, unknown>).id) },
        data: payload as Record<string, unknown>,
      })
    : null

  if (!config) {
    res.status(400).json({
      success: false,
      message:
        "A shop AI configuration must be provisioned by the admin before sellers can choose a provider or model",
    })
    return
  }

  const updatedConfig = Array.isArray(config) ? config[0] : config

  res.status(200).json({
    success: true,
    config: shapeConfig(
      platform,
      (updatedConfig as Record<string, unknown> | undefined) ?? null
    ),
  })
}
