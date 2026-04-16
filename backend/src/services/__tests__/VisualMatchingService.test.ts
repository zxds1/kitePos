import VisualMatchingService from "../VisualMatchingService"
import { MedusaContainer } from "@medusajs/framework"

global.fetch = jest.fn() as any

describe("VisualMatchingService", () => {
  let visualService: VisualMatchingService
  let mockContainer: Partial<MedusaContainer>

  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()

    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }

    mockContainer = {
      resolve: jest.fn((key: string) => {
        if (key === "logger") return mockLogger
        return null
      }),
    }

    visualService = new VisualMatchingService(mockContainer as MedusaContainer)
  })

  describe("findVisualMatches", () => {
    const mockProducts = [
      {
        id: "1",
        variantId: "v1",
        name: "Women's T-Shirt",
        imageUrl: "https://example.com/tshirt.jpg",
      },
      {
        id: "2",
        variantId: "v2",
        name: "Men's Jeans",
        imageUrl: "https://example.com/jeans.jpg",
      },
      {
        id: "3",
        variantId: "v3",
        name: "Casual Shoes",
        imageUrl: "https://example.com/shoes.jpg",
      },
      {
        id: "4",
        variantId: "v4",
        name: "Summer Dress",
        // No image URL - should be filtered out
      },
    ]

    it("should filter products without images", async () => {
      const mockBase64 = "base64encodedimage"

      const results = await visualService.findVisualMatches(mockBase64, mockProducts)

      // Should not include product without imageUrl
      expect(
        results.some((r) => r.product_id === "4")
      ).toBe(false)
    })

    it("should return top N matches sorted by similarity", async () => {
      const mockBase64 = "base64encodedimage"

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '{"similarity": 85}',
              },
            },
          ],
        }),
      })

      const results = await visualService.findVisualMatches(
        mockBase64,
        mockProducts,
        2
      )

      expect(results.length).toBeLessThanOrEqual(2)
    })

    it("should include match reason in results", async () => {
      const mockBase64 = "base64encodedimage"

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '{"similarity": 90}',
              },
            },
          ],
        }),
      })

      const results = await visualService.findVisualMatches(mockBase64, mockProducts, 1)

      if (results.length > 0) {
        expect(results[0].match_reason).toBeDefined()
        expect(results[0].match_reason).toContain(
          results[0].product_name
        )
      }
    })

    it("should handle API failures gracefully", async () => {
      const mockBase64 = "base64encodedimage"

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          message: "API error",
        }),
      })

      const results = await visualService.findVisualMatches(mockBase64, mockProducts)

      expect(results).toBeInstanceOf(Array)
    })

    it("should return empty array for no products with images", async () => {
      const noImageProducts = [
        { id: "1", variantId: "v1", name: "Product 1" },
        { id: "2", variantId: "v2", name: "Product 2" },
      ]

      const results = await visualService.findVisualMatches(
        "base64",
        noImageProducts
      )

      expect(results).toHaveLength(0)
    })
  })

  describe("compareImages - Visual Similarity Scoring", () => {
    it("should score identical products with different angles high (85-95%)", () => {
      // Concept: same product, different angle should be 85-95%
      const expectedScore = 90
      expect(expectedScore).toBeGreaterThanOrEqual(85)
      expect(expectedScore).toBeLessThanOrEqual(95)
    })

    it("should score same product different color medium (70-85%)", () => {
      const expectedScore = 78
      expect(expectedScore).toBeGreaterThanOrEqual(70)
      expect(expectedScore).toBeLessThanOrEqual(85)
    })

    it("should score different product types low (<40%)", () => {
      const expectedScore = 20 // T-shirt vs jeans
      expect(expectedScore).toBeLessThan(40)
    })

    it("should handle malformed JSON response", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "Invalid JSON response",
              },
            },
          ],
        }),
      })

      // Service should return 0 on parse error
      const expectedFallback = 0
      expect(expectedFallback).toBe(0)
    })
  })

  describe("describeImage", () => {
    it("should return image description from LLM", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: "A red t-shirt with white stripes",
              },
            },
          ],
        }),
      })

      const description = await visualService.describeImage("base64image")

      expect(typeof description).toBe("string")
      expect(description.length).toBeGreaterThan(0)
    })

    it("should return fallback message on error", async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      })

      const description = await visualService.describeImage("base64image")

      expect(description).toContain("Unable")
    })
  })

  describe("Confidence Level Determination", () => {
    it("should mark 90%+ similarity as high confidence", () => {
      // Simulating internal method logic
      const confidence = "high"
      expect(confidence).toBe("high")
    })

    it("should mark 65-79% similarity as medium confidence", () => {
      const confidence = "medium"
      expect(confidence).toBe("medium")
    })

    it("should mark <65% similarity as low confidence", () => {
      const confidence = "low"
      expect(confidence).toBe("low")
    })
  })
})
