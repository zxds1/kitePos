import AIExtractionService from "../AIExtractionService"
import { MedusaContainer } from "@medusajs/framework"

// Mock fetch for testing
global.fetch = jest.fn() as any

describe("AIExtractionService", () => {
  let extractionService: AIExtractionService
  let mockContainer: Partial<MedusaContainer>

  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()

    // Create mock logger
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }

    // Create mock container
    mockContainer = {
      resolve: jest.fn((key: string) => {
        if (key === "logger") return mockLogger
        return null
      }),
    }

    extractionService = new AIExtractionService(mockContainer as MedusaContainer)
  })

  describe("extractSalesFromImage - Receipt Mode", () => {
    it("should extract items from valid receipt image", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '[{"name": "T-Shirt", "quantity": 2}, {"name": "Jeans", "quantity": 1}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )

      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toEqual({
        name: "T-Shirt",
        quantity: 2,
        confidence: expect.any(Number),
      })
      expect(result.items[1]).toEqual({
        name: "Jeans",
        quantity: 1,
        confidence: expect.any(Number),
      })
      expect(result.extraction_mode).toBe("receipt")
      expect(result.confidence_average).toBeGreaterThan(0)
      expect(result.confidence_average).toBeLessThanOrEqual(1)
    })

    it("should handle malformed JSON response gracefully", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
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
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )

      expect(result.items).toHaveLength(0)
      expect(result.raw_extraction).toBe("Invalid JSON response")
      expect(result.confidence_average).toBe(0)
    })

    it("should extract items from product photo mode", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '[{"name": "Dress", "quantity": 3}, {"name": "Shoes", "quantity": 2}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "product"
      )

      expect(result.items).toHaveLength(2)
      expect(result.extraction_mode).toBe("product")
      expect(result.model_used).toBe("gpt-4o-mini")
    })

    it("should filter out items with empty names", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '[{"name": "Valid Item", "quantity": 1}, {"name": "", "quantity": 2}, {"name": "Another Item", "quantity": 1}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )

      expect(result.items).toHaveLength(2)
      expect(result.items.every((item) => item.name.length > 0)).toBe(true)
    })

    it("should handle LiteeLLM API errors", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          message: "Internal server error",
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      await expect(
        extractionService.extractSalesFromImage(mockBase64, "receipt")
      ).rejects.toThrow()
    })

    it("should calculate confidence scores properly", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '[{"name": "Short", "quantity": 1, "confidence": 0.85}, {"name": "Very Long Product Name", "quantity": 1, "confidence": 0.9}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )

      expect(result.items).toHaveLength(2)
      expect(result.items[0].confidence).toBeLessThanOrEqual(1)
      expect(result.items[1].confidence).toBeLessThanOrEqual(1)
      expect(result.confidence_average).toBeGreaterThan(0)
    })

    it("should ensure quantities are positive integers", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content:
                  '[{"name": "Item1", "quantity": 2.7}, {"name": "Item2", "quantity": 0}, {"name": "Item3"}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )

      expect(result.items).toHaveLength(3)
      expect(result.items[0].quantity).toBe(3) // 2.7 rounded to 3
      expect(result.items[1].quantity).toBe(1) // 0 defaults to 1
      expect(result.items[2].quantity).toBe(1) // missing quantity defaults to 1
      expect(result.items.every((item) => item.quantity >= 1)).toBe(true)
    })

    it("should include timestamp in result", async () => {
      const mockBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '[{"name": "Item", "quantity": 1}]',
              },
            },
          ],
        }),
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

      const beforeTime = new Date()
      const result = await extractionService.extractSalesFromImage(
        mockBase64,
        "receipt"
      )
      const afterTime = new Date()

      expect(result.timestamp).toBeDefined()
      const resultTime = new Date(result.timestamp)
      expect(resultTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(resultTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })
})
