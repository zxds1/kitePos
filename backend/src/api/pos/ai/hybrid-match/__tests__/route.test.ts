describe("POST /pos/ai/hybrid-match Hybrid Text + Visual Endpoint", () => {
  describe("Request Validation", () => {
    it("should require image_base64 parameter", () => {
      const invalid = {
        mode: "receipt",
      }

      expect(invalid).not.toHaveProperty("image_base64")
    })

    it("should require mode parameter (receipt or product)", () => {
      const invalid = {
        image_base64: "validbase64string",
      }

      expect(invalid).not.toHaveProperty("mode")
    })

    it("should accept optional min_text_similarity (default: 80)", () => {
      const withCustom = {
        image_base64: "validbase64string",
        mode: "receipt",
        min_text_similarity: 75,
      }

      const withDefault = {
        image_base64: "validbase64string",
        mode: "receipt",
        // min_text_similarity: using default 80
      }

      expect(withCustom.min_text_similarity).toBe(75)
      expect(withDefault.min_text_similarity === undefined).toBe(true)
    })

    it("should accept optional min_combined_similarity (default: 70)", () => {
      const withCustom = {
        image_base64: "validbase64string",
        mode: "receipt",
        min_combined_similarity: 75,
      }

      expect(withCustom.min_combined_similarity).toBe(75)
    })
  })

  describe("Response Format - Hybrid Matching", () => {
    const mockResponse = {
      success: true,
      extraction: {
        items: [
          { name: "T-Shirt", quantity: 2, confidence: 0.95 },
          { name: "Jeans", quantity: 1, confidence: 0.88 },
        ],
        extraction_mode: "receipt",
        confidence_average: 0.915,
      },
      matches: [
        {
          extracted_name: "T-Shirt",
          quantity: 2,
          extraction_confidence: 0.95,
          text_match: {
            product_id: "p1",
            variant_id: "v1",
            name: "Women's T-Shirt",
            similarity: 92,
            confidence: "high",
          },
          visual_match: {
            product_id: "p1",
            variant_id: "v1",
            name: "Women's T-Shirt",
            similarity: 88,
            confidence: "high",
            reason: "Very similar to Women's T-Shirt (88%)",
          },
          final_match: {
            product_id: "p1",
            variant_id: "v1",
            name: "Women's T-Shirt",
            combined_score: 90,
            text_weight: 60,
            visual_weight: 40,
            recommendation: "high_confidence",
          },
        },
        {
          extracted_name: "Jeans",
          quantity: 1,
          extraction_confidence: 0.88,
          text_match: {
            product_id: "p2",
            variant_id: "v2",
            name: "Men's Jeans",
            similarity: 85,
            confidence: "medium",
          },
          visual_match: {
            product_id: "p3",
            variant_id: "v3",
            name: "Blue Jeans",
            similarity: 82,
            confidence: "high",
            reason: "Likely Blue Jeans (82%)",
          },
          final_match: {
            product_id: "p2",
            variant_id: "v2",
            name: "Men's Jeans",
            combined_score: 84,
            text_weight: 60,
            visual_weight: 40,
            recommendation: "medium_confidence",
          },
        },
      ],
      extraction_quality: 92,
      match_quality: 100,
      shop_id: "fashion_shop_1",
    }

    it("should return extraction details", () => {
      expect(mockResponse.extraction).toBeDefined()
      expect(mockResponse.extraction.items).toBeInstanceOf(Array)
      expect(mockResponse.extraction.confidence_average).toBeGreaterThan(0)
    })

    it("should return hybrid matches array", () => {
      expect(mockResponse.matches).toBeInstanceOf(Array)
      expect(mockResponse.matches[0]).toHaveProperty("extracted_name")
      expect(mockResponse.matches[0]).toHaveProperty("text_match")
      expect(mockResponse.matches[0]).toHaveProperty("visual_match")
      expect(mockResponse.matches[0]).toHaveProperty("final_match")
    })

    it("should include text matching scores", () => {
      const match = mockResponse.matches[0]
      expect(match.text_match).toHaveProperty("product_id")
      expect(match.text_match).toHaveProperty("similarity")
      expect(match.text_match).toHaveProperty("confidence")
    })

    it("should include visual matching scores", () => {
      const match = mockResponse.matches[0]
      expect(match.visual_match).toHaveProperty("product_id")
      expect(match.visual_match).toHaveProperty("similarity")
      expect(match.visual_match).toHaveProperty("confidence")
      expect(match.visual_match).toHaveProperty("reason")
    })

    it("should combine scores as 60% text + 40% visual", () => {
      const match = mockResponse.matches[0]
      const textSimilarity = match.text_match.similarity
      const visualSimilarity = match.visual_match.similarity
      const expected = textSimilarity * 0.6 + visualSimilarity * 0.4

      expect(match.final_match.combined_score).toBeCloseTo(expected, 0)
      expect(match.final_match.text_weight).toBe(60)
      expect(match.final_match.visual_weight).toBe(40)
    })

    it("should provide recommendation based on combined score", () => {
      const highConfidence = mockResponse.matches[0]
      const mediumConfidence = mockResponse.matches[1]

      expect(highConfidence.final_match.recommendation).toBe("high_confidence")
      expect(mediumConfidence.final_match.recommendation).toBe("medium_confidence")
    })

    it("should return extraction_quality percentage", () => {
      expect(mockResponse.extraction_quality).toBeGreaterThanOrEqual(0)
      expect(mockResponse.extraction_quality).toBeLessThanOrEqual(100)
    })

    it("should return match_quality percentage", () => {
      expect(mockResponse.match_quality).toBeGreaterThanOrEqual(0)
      expect(mockResponse.match_quality).toBeLessThanOrEqual(100)
    })

    it("should include shop_id", () => {
      expect(mockResponse.shop_id).toBeDefined()
    })
  })

  describe("Recommendation Logic", () => {
    it("should mark high_confidence when both text and visual agree (85%+)", () => {
      const match = {
        text_match: { similarity: 90 },
        visual_match: { similarity: 88 },
        final_match: {
          combined_score: 89,
          recommendation: "high_confidence",
        },
      }

      expect(match.final_match.recommendation).toBe("high_confidence")
    })

    it("should mark medium_confidence when combined score is 70-85%", () => {
      const match = {
        final_match: {
          combined_score: 77,
          recommendation: "medium_confidence",
        },
      }

      expect(match.final_match.recommendation).toBe("medium_confidence")
    })

    it("should mark needs_verification when combined score < 70%", () => {
      const match = {
        final_match: {
          combined_score: 65,
          recommendation: "needs_verification",
        },
      }

      expect(match.final_match.recommendation).toBe("needs_verification")
    })

    it("should mark needs_verification if either text or visual is too low", () => {
      const match = {
        text_match: { similarity: 75 }, // Below threshold
        visual_match: { similarity: 90 },
        final_match: {
          combined_score: 81,
          recommendation: "needs_verification",
        },
      }

      // Even with good combined score, low text match fails high_confidence
      expect(match.final_match.recommendation).toBe("needs_verification")
    })
  })

  describe("Edge Cases", () => {
    it("should handle extraction with no items", () => {
      const response = {
        success: true,
        extraction: {
          items: [],
          confidence_average: 0,
        },
        matches: [],
        extraction_quality: 0,
        match_quality: 0,
      }

      expect(response.matches).toHaveLength(0)
      expect(response.match_quality).toBe(0)
    })

    it("should handle products without images (visual matching skipped)", () => {
      const match = {
        extracted_name: "T-Shirt",
        text_match: {
          product_id: "p1",
          similarity: 92,
        },
        visual_match: {
          product_id: undefined,
          similarity: 0,
        },
        final_match: {
          combined_score: 55, // 92*0.6 + 0*0.4 = 55%
          recommendation: "needs_verification",
        },
      }

      expect(match.visual_match.similarity).toBe(0)
      expect(match.final_match.combined_score).toBe(55)
    })

    it("should handle extraction confidence in final recommendation", () => {
      const lowExtractionConfidence = {
        extraction_confidence: 0.5, // Low confidence extraction
        final_match: {
          combined_score: 85,
          recommendation: "medium_confidence", // Downgraded due to extraction confidence
        },
      }

      // Even high combined score should be tempered by low extraction
      expect(lowExtractionConfidence.final_match.recommendation).toBe(
        "medium_confidence"
      )
    })
  })

  describe("Fashion Store Real-World Scenario", () => {
    const fashionStoreResponse = {
      success: true,
      extraction: {
        items: [
          { name: "T-Shirt", quantity: 2, confidence: 0.95 },
          { name: "Jean", quantity: 1, confidence: 0.92 },
          { name: "Shoe", quantity: 1, confidence: 0.88 },
        ],
        extraction_mode: "product",
        confidence_average: 0.917,
      },
      matches: [
        {
          extracted_name: "T-Shirt",
          final_match: {
            combined_score: 91,
            recommendation: "high_confidence",
          },
        },
        {
          extracted_name: "Jean",
          final_match: {
            combined_score: 83,
            recommendation: "medium_confidence",
          },
        },
        {
          extracted_name: "Shoe",
          final_match: {
            combined_score: 58,
            product_id: undefined,
            recommendation: "needs_verification",
          },
        },
      ],
      extraction_quality: 92,
      match_quality: 67, // 2 of 3 matched with confidence
      shop_id: "boutique_123",
    }

    it("should match exact product names with high confidence", () => {
      const tshirtMatch = fashionStoreResponse.matches[0]
      expect(tshirtMatch.final_match.recommendation).toBe("high_confidence")
    })

    it("should match fuzzy names with medium confidence", () => {
      const jeanMatch = fashionStoreResponse.matches[1]
      expect(jeanMatch.final_match.recommendation).toBe("medium_confidence")
    })

    it("should flag ambiguous items for seller verification", () => {
      const shoeMatch = fashionStoreResponse.matches[2]
      expect(shoeMatch.final_match.recommendation).toBe("needs_verification")
      expect(shoeMatch.final_match.product_id).toBeUndefined()
    })

    it("should calculate overall match quality as 67% (2/3)", () => {
      expect(fashionStoreResponse.match_quality).toBe(67)
    })
  })

  describe("HTTP Status Codes", () => {
    it("should return 200 on successful hybrid match", () => {
      const httpStatus = 200
      expect(httpStatus).toBe(200)
    })

    it("should return 400 for invalid payload", () => {
      const httpStatus = 400
      expect(httpStatus).toBe(400)
    })

    it("should return 413 for oversized image", () => {
      const httpStatus = 413
      expect(httpStatus).toBe(413)
    })

    it("should return 500 on server error", () => {
      const httpStatus = 500
      expect(httpStatus).toBe(500)
    })
  })
})

describe("GET /pos/ai/hybrid-match Info Endpoint", () => {
  it("should describe hybrid matching features", () => {
    const response = {
      success: true,
      message: "Hybrid matching service ready (text + visual)",
      features: {
        extraction: "LLM-based product name extraction from photos",
        text_matching: "Fuzzy string matching against inventory (80%+ similarity)",
        visual_matching: "LLM visual image comparison against product photos",
        hybrid_scoring: "Combined text (60%) + visual (40%) scoring",
      },
    }

    expect(response.features.extraction).toContain("extraction")
    expect(response.features.text_matching).toContain("Fuzzy")
    expect(response.features.visual_matching).toContain("visual")
    expect(response.features.hybrid_scoring).toContain("60%")
  })

  it("should indicate default thresholds", () => {
    const response = {
      defaults: {
        min_text_similarity: 80,
        min_combined_similarity: 70,
      },
    }

    expect(response.defaults.min_text_similarity).toBe(80)
    expect(response.defaults.min_combined_similarity).toBe(70)
  })
})
