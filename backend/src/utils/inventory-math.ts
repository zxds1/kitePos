import { InventoryType, SellingUnit } from "../types/inventory"

export function calculateDeduction(
  type: InventoryType,
  sellingUnit: string,
  sellingUnits: SellingUnit[]
): number {
  const config = sellingUnits.find((unit) => unit.unit === sellingUnit)

  if (!config) {
    throw new Error(`Selling unit ${sellingUnit} not configured`)
  }

  return config.conversion_value
}

export function validateStock(current: number, deduction: number): boolean {
  return current - deduction >= 0
}
