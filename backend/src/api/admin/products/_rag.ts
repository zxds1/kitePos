export function buildProductEmbeddingText(product: Record<string, unknown>) {
  const sellingUnits = Array.isArray(product.selling_units)
    ? (product.selling_units as Array<Record<string, unknown>>)
    : []
  const primarySellingUnit = sellingUnits[0] ?? {}

  return [
    `Product: ${String(product.name ?? "")}`,
    `Category: ${String(product.category ?? "General")}`,
    `Brand: ${String(product.brand ?? "N/A")}`,
    `Price KES: ${String(primarySellingUnit.price ?? 0)}`,
    `Stock: ${String(product.stock_remaining ?? 0)}`,
    `Inventory type: ${String(product.inventory_type ?? "standard")}`,
    `Purchase unit: ${String(product.purchase_unit ?? "Unit")}`,
    `Model: ${String(product.model_name ?? product.style_code ?? "N/A")}`,
  ].join(", ")
}
