type EmbeddingOptions = {
  baseUrl?: string
  apiKey?: string | null
  model?: string
}

export class EmbeddingService {
  private readonly litellmBaseUrl: string
  private readonly litellmApiKey: string | null
  private readonly embeddingModel: string

  constructor(options: EmbeddingOptions = {}) {
    this.litellmBaseUrl =
      options.baseUrl ?? process.env.LITELLM_BASE_URL ?? "http://localhost:4000"
    this.litellmApiKey = options.apiKey ?? process.env.LITELLM_API_KEY ?? null
    this.embeddingModel =
      options.model ?? process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small"
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const [embedding] = await this.batchGenerateEmbeddings([text])
    return embedding ?? []
  }

  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return []
    }

    const response = await fetch(`${this.litellmBaseUrl}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.litellmApiKey
          ? { Authorization: `Bearer ${this.litellmApiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: texts,
        encoding_format: "float",
      }),
    })

    if (!response.ok) {
      throw new Error(`Embedding service unavailable: ${await response.text()}`)
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] | null }>
    }

    return (payload.data ?? []).map((entry) => entry.embedding ?? [])
  }

  estimateTokens(text: string) {
    return Math.max(1, Math.ceil(text.trim().length / 4))
  }

  calculateCostKes(tokenCount: number) {
    const usdPer1K = this.embeddingModel.includes("large") ? 0.00013 : 0.00002
    const costUsd = (tokenCount / 1000) * usdPer1K
    return Math.round(costUsd * 130 * 1000) / 1000
  }
}
