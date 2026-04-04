import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  authenticatePosJwt,
  type PosAuthenticatedRequest,
} from "../../../../auth/_utils/jwt"
import { AIService } from "../../../../../services/ai.service"
import { RAGFlowService } from "../../../../../services/ragflow.service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auth = authenticatePosJwt(req as PosAuthenticatedRequest, res)
  if (!auth?.shop_id) {
    return
  }

  const config = await new AIService(req.scope).resolveConfig(auth.shop_id)
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

  try {
    const status = await ragflow.healthCheck()
    res.status(200).json({
      success: true,
      ragflow: status,
      pgvector: {
        enabled: config.rag_enabled !== false,
        embedding_model: config.embedding_model ?? "text-embedding-3-small",
      },
    })
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error instanceof Error ? error.message : "RAG health check failed",
    })
  }
}
