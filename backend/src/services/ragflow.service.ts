type DocumentType = "receipt" | "invoice" | "catalog" | "policy"

type UploadDocumentInput = {
  file: Buffer
  fileName: string
  knowledgeBaseId: string
  documentType: DocumentType
  shopId: string
}

type QueryDocumentsInput = {
  query: string
  knowledgeBaseId: string
  shopId: string
  topK?: number
  scoreThreshold?: number
}

type RAGFlowConfig = {
  baseUrl?: string
  apiKey?: string | null
  webUrl?: string
}

export class RAGFlowService {
  private readonly ragflowBaseUrl: string
  private readonly ragflowWebUrl: string
  private readonly apiKey: string | null

  constructor(config: RAGFlowConfig = {}) {
    this.ragflowBaseUrl =
      config.baseUrl ?? process.env.RAGFLOW_BASE_URL ?? "http://localhost:8080"
    this.ragflowWebUrl =
      config.webUrl ?? process.env.RAGFLOW_WEB_URL ?? "http://localhost:9380"
    this.apiKey = config.apiKey ?? process.env.RAGFLOW_API_KEY ?? null
  }

  async uploadDocument(input: UploadDocumentInput) {
    const formData = new FormData()
    formData.append(
      "file",
      new Blob([new Uint8Array(input.file)]),
      input.fileName
    )
    formData.append("knowledge_base_id", input.knowledgeBaseId)
    formData.append("document_type", input.documentType)
    formData.append("shop_id", input.shopId)

    const response = await fetch(`${this.ragflowBaseUrl}/api/v1/documents/upload`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`RAGFlow upload failed: ${await response.text()}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      documentId: String(payload.document_id ?? payload.id ?? ""),
      status: String(payload.status ?? "uploaded"),
      fileName: String(payload.file_name ?? input.fileName),
    }
  }

  async query(input: QueryDocumentsInput) {
    const response = await fetch(`${this.ragflowBaseUrl}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: input.query,
        knowledge_base_id: input.knowledgeBaseId,
        shop_id: input.shopId,
        top_k: input.topK ?? 5,
        score_threshold: input.scoreThreshold ?? 0.7,
        hybrid_search: true,
        re_rank: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`RAGFlow query failed: ${await response.text()}`)
    }

    const payload = (await response.json()) as Record<string, any>
    return {
      response: String(payload.response ?? ""),
      sources: Array.isArray(payload.sources) ? payload.sources : [],
      tokensUsed: Number(payload.usage?.total_tokens ?? 0),
      costKes: Number(payload.usage?.cost_kes ?? 0),
    }
  }

  async getOrCreateKnowledgeBase(shopId: string, shopName: string) {
    try {
      const response = await fetch(
        `${this.ragflowBaseUrl}/api/v1/knowledge_bases?shop_id=${encodeURIComponent(shopId)}`,
        { headers: this.buildHeaders() }
      )

      if (response.ok) {
        const payload = (await response.json()) as Record<string, any>
        const knowledgeBases = Array.isArray(payload.knowledge_bases)
          ? payload.knowledge_bases
          : []
        if (knowledgeBases.length > 0) {
          return String(knowledgeBases[0]?.id ?? "")
        }
      }
    } catch {}

    const response = await fetch(`${this.ragflowBaseUrl}/api/v1/knowledge_bases`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `${shopName} Documents`,
        description: `Hybrid RAG documents for ${shopName}`,
        shop_id: shopId,
        document_types: ["receipt", "invoice", "catalog", "policy"],
      }),
    })

    if (!response.ok) {
      throw new Error(`RAGFlow knowledge base failed: ${await response.text()}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    return String(payload.id ?? "")
  }

  async healthCheck() {
    const response = await fetch(`${this.ragflowBaseUrl}/api/v1/health`, {
      headers: this.buildHeaders(),
    })

    if (!response.ok) {
      throw new Error(`RAGFlow health check failed: ${await response.text()}`)
    }

    const payload = (await response.json()) as Record<string, unknown>
    return {
      status: String(payload.status ?? "unknown"),
      version: String(payload.version ?? "unknown"),
      webUrl: this.ragflowWebUrl,
    }
  }

  private buildHeaders() {
    const headers: Record<string, string> = {}
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }
    return headers
  }
}
