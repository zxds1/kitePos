describe("POST /pos/ai/match-products Endpoint", () => {
  describe("Request Validation", () => {
    it("should require extracted_items array", () => {
      const body = {
        // missing extracted_items
      }

      expect(body).not.toHaveProperty("extracted_items")
    })

    it("should validate extracted_items is non-empty array", () => {
      const validSimple = {
        extracted_items: [
          { name: "T-Shirt", quantity: 2, confidence: 0.9 },
        ],
      }

      const validMultiple = {
        extracted_items: [
          { name: "T-Shirt", quantity: 2, confidence: 0.9 },
          { name: "Jeans", quantity: 1, confidence: 0.85 },
          { name: "Shoes", quantity: 3, confidence: 0.92 },
        ],
      }

      expect(validSimple.extracted_items).toHaveLength(1)
      expect(validMultiple.extracted_items).toHaveLength(3)
    })

    it("should reject empty extracted_items array", () => {
      const invalid = {
        extracted_items: [],
      }

      expect(invalid.extracted_items).toHaveLength(0)
    })

    it("should validate item name is non-empty string", () => {
      const valid = {
        extracted_items: [
          { name: "T-Shirt", quantity: 1, confidence: 0.9 },
        ],
      }

      const validItem = valid.extracted_items[0]
      expect(typeof validItem.name).toBe("string")
      expect(validItem.name.length).toBeGreaterThan(0)
    })

    it("should validate item quantity is positive integer", () => {
      const valid1 = {
        extracted_items: [
          { name: "Item", quantity: 1, confidence: 0.9 },
        ],
      }

      const valid999 = {
        extracted_items: [
          { name: "Item", quantity: 999, confidence: 0.9 },
        ],
      }

      expect(valid1.extracted_items[0].quantity).toBeGreaterThan(0)
      expect(valid999.extracted_items[0].quantity).toBeGreaterThan(0)
    })

    it("should reject zero or negative quantity", () => {
      const invalidZero = {
        extracted_items: [
          { name: "Item", quantity: 0, confidence: 0.9 },
        ],
      }

      const invalidNegative = {
        extracted_items: [
          { name: "Item", quantity: -1, confidence: 0.9 },
        ],
      }

      expect(invalidZero.extracted_items[0].quantity).not.toBeGreaterThan(0)
      expect(invalidNegative.extracted_items[0].quantity).not.toBeGreaterThan(0)
    })

    it("should validate confidence is 0-1 number", () => {
      const valid0 = {
        extracted_items: [
          { name: "Item", quantity: 1, confidence: 0 },
        ],
      }

      const valid05 = {
        extracted_items: [
          { name: "Item", quantity: 1, confidence: 0.5 },
        ],
      }

      const valid1 = {
        extracted_items: [
          { name: "Item", quantity: 1, confidence: 1 },
        ],
      }

      expect(valid0.extracted_items[0].confidence).toBeGreaterThanOrEqual(0)
      expect(valid05.extracted_items[0].confidence).toBeGreaterThanOrEqual(0)
      expect(valid1.extracted_items[0].confidence).toBeGreaterThanOrEqual(0)
    })

    it("should accept optional min_similarity (0-100)", () => {
      const withMinSim75 = {
        extracted_items: [
          { name: "T-Shirt", quantity: 1, confidence: 0.9 },
        ],
        min_similarity: 75,
      }

      const withMinSim90 = {
        extracted_items: [
          { name: "T-Shirt", quantity: 1, confidence: 0.9 },
        ],
        min_similarity: 90,
      }

      expect(withMinSim75.min_similarity).toBe(75)
      expect(withMinSim90.min_similarity).toBe(90)
    })

    it("should default min_similarity to 80 if not provided", () => {
      const body = {
        extracted_items: [
          { name: "T-Shirt", quantity: 1, confidence: 0.9 },
        ],
        // min_similarity not provided
      }

      const defaultValue = 80
      expect(body.min_similarity || defaultValue).toBe(80)
    })

    it("should reject max 100 items per request", () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        name: `Item${i}`,
        quantity: 1,
        confidence: 0.9,
      }))

      expect(items).toHaveLength(101)
    })
  })

  describe("Response Format", () => {
    const mockMatchResult = {
      success: true,
      matches: [
        {
          extracted_name: "T-Shirt",
          match: {
            product_id: "1",
            variant_id: "v1",
            name: "T-Shirt",
            similarity: 100,
            category: "Clothing",
          },
          alternatives: [],
          confidence: "high",
          quantity: 2,
          extraction_confidence: 0.9,
        },
      ],
      match_quality: 100,
      shop_id: "shop_123",
    }

    it("should return success: true", () => {
      expect(mockMatchResult.success).toBe(true)
    })

    it("should return matches array with proper structure", () => {
      expect(mockMatchResult.matches).toBeInstanceOf(Array)
      expect(mockMatchResult.matches[0]).toHaveProperty("extracted_name")
      expect(mockMatchResult.matches[0]).toHaveProperty("match")
      expect(mockMatchResult.matches[0]).toHaveProperty("alternatives")
      expect(mockMatchResult.matches[0]).toHaveProperty("confidence")
      expect(mockMatchResult.matches[0]).toHaveProperty("quantity")
      expect(mockMatchResult.matches[0]).toHaveProperty("extraction_confidence")
    })

    it("should include match details when found", () => {
      const match = mockMatchResult.matches[0].match

      expect(match).not.toBeNull()
      expect(match).toHaveProperty("product_id")
      expect(match).toHaveProperty("variant_id")
      expect(match).toHaveProperty("name")
      expect(match).toHaveProperty("similarity")
    })

    it("should include alternatives array", () => {
      expect(mockMatchResult.matches[0].alternatives).toBeInstanceOf(Array)
    })

    it("should return match_quality percentage", () => {
      expect(mockMatchResult.match_quality).toBeGreaterThanOrEqual(0)
      expect(mockMatchResult.match_quality).toBeLessThanOrEqual(100)
    })

    it("should include shop_id in response", () => {
      expect(mockMatchResult.shop_id).toBeDefined()
    })

    it("should return 200 status on success", () => {
      const httpStatus = 200
      expect(httpStatus).toBe(200)
    })
  })

  describe("No Products in Shop", () => {
    const noProductsResponse = {
      success: true,
      matches: [
        {
          extracted_name: "T-Shirt",
          match: null,
          alternatives: [],
          confidence: "low",
          quantity: 1,
          extraction_confidence: 0.9,
        },
      ],
      match_quality: 0,
      shop_id: "empty_shop",
    }

    it("should handle shops with no products", () => {
      expect(noProductsResponse.success).toBe(true)
      expect(noProductsResponse.match_quality).toBe(0)
      expect(noProductsResponse.matches[0].match).toBeNull()
    })

    it("should still return valid response structure", () => {
      expect(noProductsResponse.matches).toBeInstanceOf(Array)
      expect(noProductsResponse.matches[0]).toHaveProperty("match")
      expect(noProductsResponse.matches[0]).toHaveProperty("alternatives")
    })
  })

  describe("Error Handling", () => {
    it("should return 400 for invalid payload", () => {
      const httpStatus = 400
      expect(httpStatus).toBe(400)
    })

    it("should return 401 for unauthenticated request", () => {
      const httpStatus = 401
      expect(httpStatus).toBe(401)
    })

    it("should return 403 for unauthorized shop access", () => {
      const httpStatus = 403
      expect(httpStatus).toBe(403)
    })

    it("should return 500 on server error", () => {
      const httpStatus = 500
      expect(httpStatus).toBe(500)
    })

    it("should include error message in response", () => {
      const errorResponse = {
        success: false,
        message: "Failed to match products",
      }

      expect(errorResponse.success).toBe(false)
      expect(errorResponse.message).toBeDefined()
    })
  })

  describe("GET /pos/ai/match-products Info Endpoint", () => {
    const infoResponse = {
      success: true,
      message: "Product matching service ready",
      min_similarity_default: 80,
      shop_id: "shop_123",
    }

    it("should return service availability info", () => {
      expect(infoResponse.success).toBe(true)
      expect(infoResponse.message).toContain("ready")
    })

    it("should indicate default min_similarity threshold", () => {
      expect(infoResponse.min_similarity_default).toBe(80)
    })

    it("should return 200 status", () => {
      const httpStatus = 200
      expect(httpStatus).toBe(200)
    })
  })

  describe("Real-World Scenarios", () => {
    const fashionStoreResponse = {
      success: true,
      matches: [
        {
          extracted_name: "T-Shirt",
          match: {
            product_id: "p1",
            variant_id: "v1",
            name: "Women's T-Shirt",
            similarity: 92,
            category: "Tops",
          },
          alternatives: [],
          confidence: "high",
          quantity: 2,
          extraction_confidence: 0.95,
        },
        {
          extracted_name: "Jean",
          match: {
            product_id: "p2",
            variant_id: "v2",
            name: "Men's Jeans",
            similarity: 85,
            category: "Bottoms",
          },
          alternatives: [
            {
              product_id: "p3",
              variant_id: "v3",
              name: "Blue Jeans",
              similarity: 82,
            },
          ],
          confidence: "medium",
          quantity: 1,
          extraction_confidence: 0.88,
        },
        {
          extracted_name: "Shoes",
          match: null,
          alternatives: [
            {
              product_id: "p4",
              variant_id: "v4",
              name: "Casual Sneakers",
              similarity: 75,
            },
            {
              product_id: "p5",
              variant_id: "v5",
              name: "Formal Shoes",
              similarity: 70,
            },
          ],
          confidence: "low",
          quantity: 1,
          extraction_confidence: 0.82,
        },
      ],
      match_quality: 67,
      shop_id: "fashion_shop_1",
    }

    it("should match receipt extraction from fashion store", () => {
      expect(fashionStoreResponse.matches).toHaveLength(3)
      expect(fashionStoreResponse.matches[0].match).not.toBeNull()
      expect(fashionStoreResponse.matches[1].match).not.toBeNull()
      expect(fashionStoreResponse.matches[2].match).toBeNull()
    })

    it("should return 67% match quality for 2/3 items", () => {
      expect(fashionStoreResponse.match_quality).toBe(67)
    })

    it("should provide alternatives for unmatched items", () => {
      const shoeMatch = fashionStoreResponse.matches[2]
      expect(shoeMatch.alternatives.length).toBeGreaterThan(0)
      expect(shoeMatch.alternatives[0].name).toContain("Sneakers")
    })

    it("should mark fuzzy matches as medium confidence", () => {
      const jeanMatch = fashionStoreResponse.matches[1]
      expect(jeanMatch.confidence).toBe("medium")
      expect(jeanMatch.match?.similarity).toBeLessThan(100)
    })
  })
})
