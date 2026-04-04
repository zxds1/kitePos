import { model } from "@medusajs/framework/utils"

const AiOperationLog = model.define("ai_operation_log", {
  id: model.id().primaryKey(),
  shop_id: model.text(),
  operation_type: model.text(),
  provider: model.text(),
  model: model.text(),
  prompt_tokens: model.number().default(0),
  completion_tokens: model.number().default(0),
  total_tokens: model.number().default(0),
  cost_kes: model.bigNumber().default(0),
  latency_ms: model.number().default(0),
  success: model.boolean().default(true),
  error_message: model.text().nullable(),
  request_excerpt: model.text().nullable(),
  response_excerpt: model.text().nullable(),
  rag_source: model.text().default("llm"),
  cache_hit: model.boolean().default(false),
  cached: model.boolean().default(false),
  metadata: model.json().nullable(),
  occurred_at: model.dateTime(),
})

export default AiOperationLog
