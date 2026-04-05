import { describe, it, expect, beforeEach } from "vitest"
import ProductMatchingService, {
  calculateSimilarity,
} from "../../../services/ProductMatchingService"

describe("ProductMatchingService", () => {
  let matchingService: ProductMatchingService

  beforeEach(() => {
    matchingService = new ProductMatchingService()
  })

  describe("calculateSimilarity", () => {
    it("should return 100 for identical strings", () => {
      expect(calculateSimilarity("T-Shirt", "T-Shirt")).toBe(100)
    })

    it("should return 100 for identical strings with different case", () => {
      expect(calculateSimilarity("T-Shirt", "t-shirt")).toBe(100)
    })

    it("should return 100 for identical strings with extra whitespace", () => {
      expect(calculateSimilarity("  T-Shirt  ", "T-Shirt")).toBe(100)
    })

    it("should calculate high similarity for very similar strings", () => {
      const similarity = calculateSimilarity("T-Shirt", "T Shirt")
      expect(similarity).toBeGreaterThanOrEqual(80)
    })

    it("should calculate medium similarity for partially similar strings", () => {
      const similarity = calculateSimilarity("T-Shirt", "Shirt")
      expect(similarity).toBeGreaterThan(60)
      expect(similarity).toBeLessThan(90)
    })

    it("should calculate low similarity for very different strings", () => {
      const similarity = calculateSimilarity("T-Shirt", "Shoes")
      expect(similarity).toBeLessThan(50)
    })

    it("should return 0 for completely different strings", () => {
      const similarity = calculateSimilarity("ABCDEFGH", "IJKLMNOP")
      expect(similarity).toBeLessThan(20)
    })

    it("should handle empty strings", () => {
      expect(calculateSimilarity("", "")).toBe(100)
      expect(calculateSimilarity("test", "")).toBeLessThan(50)
      expect(calculateSimilarity("", "test")).toBeLessThan(50)
    })

    it("should be case-insensitive", () => {
      expect(calculateSimilarity("JEANS", "jeans")).toBe(100)
    })

    it("should handle typos and misspellings", () => {
      const similarity = calculateSimilarity("Shoes", "Shoess")
      expect(similarity).toBeGreaterThanOrEqual(85)
    })
  })

  describe("findBestMatch", () => {
    const mockProducts = [
      { id: "1", variantId: "v1", name: "T-Shirt", category: "Clothing" },
      { id: "2", variantId: "v2", name: "Jeans", category: "Clothing" },
      { id: "3", variantId: "v3", name: "Blue Jeans", category: "Clothing" },
      { id: "4", variantId: "v4", name: "Shoes", category: "Footwear" },
      {
        id: "5",
        variantId: "v5",
        name: "Sneakers",
        category: "Footwear",
      },
    ]

    it("should return exact match with high confidence", () => {
      const result = matchingService.findBestMatch("T-Shirt", mockProducts)

      expect(result.extracted_name).toBe("T-Shirt")
      expect(result.match).not.toBeNull()
      expect(result.match?.name).toBe("T-Shirt")
      expect(result.match?.product_id).toBe("1")
      expect(result.confidence).toBe("high")
    })

    it("should return fuzzy match above 80% similarity", () => {
      const result = matchingService.findBestMatch("T Shirt", mockProducts)

      expect(result.match).not.toBeNull()
      expect(result.match?.name).toBe("T-Shirt")
      expect(result.confidence).toMatch(/high|medium/)
    })

    it("should return null match below 80% similarity", () => {
      const result = matchingService.findBestMatch("Dress", mockProducts)

      expect(result.match).toBeNull()
      expect(result.confidence).toBe("low")
    })

    it("should provide alternatives when no exact match", () => {
      const result = matchingService.findBestMatch("Jeanss", mockProducts)

      expect(result.alternatives.length).toBeGreaterThan(0)
      expect(result.alternatives[0].name).toBe("Jeans")
    })

    it("should sort alternatives by similarity", () => {
      const result = matchingService.findBestMatch("Jeans", mockProducts)

      if (result.alternatives.length > 1) {
        for (let i = 0; i < result.alternatives.length - 1; i++) {
          expect(result.alternatives[i].similarity).toBeGreaterThanOrEqual(
            result.alternatives[i + 1].similarity
          )
        }
      }
    })

    it("should handle empty product list", () => {
      const result = matchingService.findBestMatch("T-Shirt", [])

      expect(result.match).toBeNull()
      expect(result.alternatives).toHaveLength(0)
      expect(result.confidence).toBe("low")
    })

    it("should handle empty extracted name", () => {
      const result = matchingService.findBestMatch("", mockProducts)

      expect(result.match).toBeNull()
      expect(result.confidence).toBe("low")
    })

    it("should respect custom minSimilarity threshold", () => {
      const result90 = matchingService.findBestMatch("T Shirt", mockProducts, 90)
      const result70 = matchingService.findBestMatch("T Shirt", mockProducts, 70)

      // With higher threshold, might not match
      if (result90.match?.similarity) {
        expect(result90.match.similarity).toBeGreaterThanOrEqual(90)
      }
      // With lower threshold, more likely to match
      if (result70.match) {
        expect(result70.match.similarity).toBeGreaterThanOrEqual(70)
      }
    })

    it("should return top 3 alternatives only", () => {
      const result = matchingService.findBestMatch("Shoe", mockProducts)

      expect(result.alternatives.length).toBeLessThanOrEqual(3)
    })

    it("should include product metadata in results", () => {
      const result = matchingService.findBestMatch("T-Shirt", mockProducts)

      expect(result.match).toHaveProperty("product_id")
      expect(result.match).toHaveProperty("variant_id")
      expect(result.match).toHaveProperty("name")
      expect(result.match).toHaveProperty("similarity")
      expect(result.match).toHaveProperty("category")
    })

    it("should handle special characters in product names", () => {
      const productsWithSpecial = [
        {
          id: "1",
          variantId: "v1",
          name: "T-Shirt (Cotton)",
        },
        {
          id: "2",
          variantId: "v2",
          name: "Jeans - Regular Fit",
        },
      ]

      const result = matchingService.findBestMatch(
        "T-Shirt Cotton",
        productsWithSpecial
      )

      expect(result.match).not.toBeNull()
      expect(result.match?.name).toContain("T-Shirt")
    })
  })

  describe("findMatches - Batch Processing", () => {
    const mockProducts = [
      { id: "1", variantId: "v1", name: "T-Shirt" },
      { id: "2", variantId: "v2", name: "Jeans" },
      { id: "3", variantId: "v3", name: "Shoes" },
    ]

    it("should match multiple items", () => {
      const results = matchingService.findMatches(
        ["T-Shirt", "Jeans", "Shoes"],
        mockProducts
      )

      expect(results).toHaveLength(3)
      expect(results[0].match?.name).toBe("T-Shirt")
      expect(results[1].match?.name).toBe("Jeans")
      expect(results[2].match?.name).toBe("Shoes")
    })

    it("should handle mixed exact and fuzzy matches", () => {
      const results = matchingService.findMatches(
        ["T-Shirt", "Jean", "Shoess"],
        mockProducts
      )

      expect(results).toHaveLength(3)
      expect(results[0].match?.name).toBe("T-Shirt")
      expect(results[1].match?.name).toBe("Jeans")
      expect(results[2].match?.name).toBe("Shoes")
    })

    it("should handle no matches", () => {
      const results = matchingService.findMatches(
        ["Hat", "Socks", "Tie"],
        mockProducts
      )

      expect(results.every((r) => r.match === null)).toBe(true)
    })

    it("should handle mixed matches and non-matches", () => {
      const results = matchingService.findMatches(
        ["T-Shirt", "Hat", "Shoes"],
        mockProducts
      )

      expect(results[0].match).not.toBeNull()
      expect(results[1].match).toBeNull()
      expect(results[2].match).not.toBeNull()
    })
  })

  describe("getMatchQuality", () => {
    it("should calculate 100% quality when all items matched", () => {
      const results = [
        {
          extracted_name: "T-Shirt",
          match: { product_id: "1", variant_id: "v1", name: "T-Shirt", similarity: 100 },
          alternatives: [],
          confidence: "high",
        },
        {
          extracted_name: "Jeans",
          match: { product_id: "2", variant_id: "v2", name: "Jeans", similarity: 100 },
          alternatives: [],
          confidence: "high",
        },
      ]

      expect(matchingService.getMatchQuality(results)).toBe(100)
    })

    it("should calculate 0% quality when no items matched", () => {
      const results = [
        {
          extracted_name: "Hat",
          match: null,
          alternatives: [],
          confidence: "low",
        },
        {
          extracted_name: "Socks",
          match: null,
          alternatives: [],
          confidence: "low",
        },
      ]

      expect(matchingService.getMatchQuality(results)).toBe(0)
    })

    it("should calculate 50% quality for 1 of 2 matches", () => {
      const results = [
        {
          extracted_name: "T-Shirt",
          match: { product_id: "1", variant_id: "v1", name: "T-Shirt", similarity: 100 },
          alternatives: [],
          confidence: "high",
        },
        {
          extracted_name: "Hat",
          match: null,
          alternatives: [],
          confidence: "low",
        },
      ]

      expect(matchingService.getMatchQuality(results)).toBe(50)
    })

    it("should return 0 for empty results", () => {
      expect(matchingService.getMatchQuality([])).toBe(0)
    })
  })

  describe("Integration - Fashion Store Use Case", () => {
    const fashionStoreProducts = [
      { id: "f1", variantId: "fv1", name: "Women's T-Shirt", category: "Tops" },
      { id: "f2", variantId: "fv2", name: "Men's Jeans", category: "Bottoms" },
      {
        id: "f3",
        variantId: "fv3",
        name: "Summer Dress",
        category: "Dresses",
      },
      { id: "f4", variantId: "fv4", name: "Casual Sneakers", category: "Shoes" },
      {
        id: "f5",
        variantId: "fv5",
        name: "Leather Belt",
        category: "Accessories",
      },
    ]

    it("should match receipt extraction: 2x T-Shirt, 1x Jeans", () => {
      const extracted = ["T-Shirt", "T-Shirt", "Jeans"]
      const results = matchingService.findMatches(extracted, fashionStoreProducts)

      expect(results[0].match?.name).toContain("T-Shirt")
      expect(results[1].match?.name).toContain("T-Shirt")
      expect(results[2].match?.name).toContain("Jeans")
      expect(matchingService.getMatchQuality(results)).toBe(100)
    })

    it("should handle misspelled receipt items: 'Dreess' -> 'Summer Dress'", () => {
      const result = matchingService.findBestMatch("Dreess", fashionStoreProducts)

      expect(result.match?.name).toContain("Dress")
      expect(result.confidence).toMatch(/high|medium/)
    })

    it("should suggest alternatives when no high-confidence match", () => {
      const result = matchingService.findBestMatch("Heels", fashionStoreProducts)

      expect(result.match).toBeNull()
      expect(result.alternatives.length).toBeGreaterThan(0)
      // Alternatives should be shoe-related
      expect(
        result.alternatives.some((alt) => alt.name.toLowerCase().includes("shoe"))
      ).toBe(true)
    })

    it("should handle batch product photo extraction", () => {
      const extracted = ["dress", "sneaker", "belt", "jeans"]
      const results = matchingService.findMatches(extracted, fashionStoreProducts)
      const quality = matchingService.getMatchQuality(results)

      expect(results).toHaveLength(4)
      expect(quality).toBeGreaterThan(50) // At least half should match
    })
  })
})
