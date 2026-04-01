export type InventoryType =
  | "discrete"
  | "bulk_loose"
  | "bulk_liquid"
  | "multi_pack"
  | "expiry_tracked"

export type SellingUnit = {
  unit: string
  price: number
  conversion_value: number
}

export type RestockSource = "manual" | "barcode_scan" | "receipt_scan"
