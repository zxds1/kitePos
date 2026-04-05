/**
 * Simple Levenshtein distance implementation for fuzzy string matching
 * Measures the minimum number of single-character edits required to change one string to another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i
  }

  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      )
    }
  }

  return track[str2.length][str1.length]
}

/**
 * Calculate similarity percentage between two strings (0-100%)
 * Higher score = more similar
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 100

  const maxLen = Math.max(s1.length, s2.length)
  if (maxLen === 0) return 100

  const distance = levenshteinDistance(s1, s2)
  const similarity = ((maxLen - distance) / maxLen) * 100

  return Math.round(similarity)
}

export interface ProductMatch {
  product_id: string
  variant_id: string
  name: string
  similarity: number
  category?: string
  price?: number
  unit?: string
}

export interface ProductMatchResult {
  extracted_name: string
  match: ProductMatch | null
  alternatives: ProductMatch[]
  confidence: "high" | "medium" | "low"
}

export class ProductMatchingService {
  /**
   * Find matching product by extracted name
   * - Returns top match if similarity >= 80%
   * - Provides alternatives if no good match
   */
  findBestMatch(
    extractedName: string,
    products: Array<{
      id: string
      variantId: string
      name: string
      category?: string
      price?: number
      unit?: string
    }>,
    minSimilarity: number = 80
  ): ProductMatchResult {
    if (!extractedName || !products.length) {
      return {
        extracted_name: extractedName,
        match: null,
        alternatives: [],
        confidence: "low",
      }
    }

    // Calculate similarity for all products
    const scored = products.map((product) => ({
      product_id: product.id,
      variant_id: product.variantId,
      name: product.name,
      similarity: calculateSimilarity(extractedName, product.name),
      category: product.category,
      price: product.price,
      unit: product.unit,
    }))

    // Sort by similarity descending
    scored.sort((a, b) => b.similarity - a.similarity)

    const topMatch = scored[0]
    const alternatives = scored.slice(1, 4) // Top 3 alternatives

    // Determine confidence and best match
    let match: ProductMatch | null = null
    let confidence: "high" | "medium" | "low" = "low"

    if (topMatch.similarity >= minSimilarity) {
      match = topMatch
      if (topMatch.similarity >= 95) {
        confidence = "high"
      } else if (topMatch.similarity >= 85) {
        confidence = "medium"
      } else {
        confidence = "low"
      }
    }

    return {
      extracted_name: extractedName,
      match,
      alternatives: alternatives.filter((alt) => alt.similarity < minSimilarity),
      confidence,
    }
  }

  /**
   * Batch match multiple extracted items
   */
  findMatches(
    extractedNames: string[],
    products: Array<{
      id: string
      variantId: string
      name: string
      category?: string
      price?: number
      unit?: string
    }>,
    minSimilarity: number = 80
  ): ProductMatchResult[] {
    return extractedNames.map((name) =>
      this.findBestMatch(name, products, minSimilarity)
    )
  }

  /**
   * Get matching score summary
   * Useful for deciding if extraction quality is good enough
   */
  getMatchQuality(results: ProductMatchResult[]): number {
    if (!results.length) return 0

    const matched = results.filter((r) => r.match !== null).length
    return Math.round((matched / results.length) * 100)
  }
}

export default ProductMatchingService
