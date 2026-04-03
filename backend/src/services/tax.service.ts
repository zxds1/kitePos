import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { INPUT_VAT_RECORD_MODULE } from "../modules/input-vat-record"
import type InputVatRecordModuleService from "../modules/input-vat-record/service"
import { SALE_SNAPSHOT_MODULE } from "../modules/sale-snapshot"
import type SaleSnapshotModuleService from "../modules/sale-snapshot/service"
import { SHOP_MODULE } from "../modules/shop"
import type ShopModuleService from "../modules/shop/service"
import { SHOP_LOCATION_MODULE } from "../modules/shop-location"
import type ShopLocationModuleService from "../modules/shop-location/service"
import { TAX_INVOICE_MODULE } from "../modules/tax-invoice"
import type TaxInvoiceModuleService from "../modules/tax-invoice/service"
import { TAX_REPORT_MODULE } from "../modules/tax-report"
import type TaxReportModuleService from "../modules/tax-report/service"
import { TAX_REPORT_RUN_MODULE } from "../modules/tax-report-run"
import type TaxReportRunModuleService from "../modules/tax-report-run/service"
import { VAT_RETURN_MODULE } from "../modules/vat-return"
import type VatReturnModuleService from "../modules/vat-return/service"

type Dict = Record<string, unknown>
type TaxSettingsRecord = {
  shop_id: unknown
  shop_name: unknown
  location_id: string | null
  location_name: string | null
  is_branch_override: boolean
  kra_pin: unknown
  vat_registered: boolean
  vat_registration_number: unknown
  tax_type: string
  turnover_threshold: number
  tims_enabled: boolean
  tims_device_id: unknown
  etr_serial_number: unknown
  invoice_prefix: string
  invoice_number_sequence: number
  tax_invoice_enabled: boolean
  whvat_applicable: boolean
  whvat_registration: unknown
  tax_reporting_email: unknown
  last_vat_return_filed: unknown
  last_vat_return_period: unknown
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function toIsoMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function hasOwnEntry(record: Dict | null | undefined, key: string) {
  return !!record && Object.prototype.hasOwnProperty.call(record, key)
}

function monthBounds(period: string) {
  const [yearText, monthText] = period.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
  return { start, end }
}

type EffectiveTaxContext = {
  shop: Dict
  location: Dict | null
  settings: TaxSettingsRecord
}

export class TaxService {
  constructor(private readonly scope: MedusaContainer) {}

  private shopService() {
    return this.scope.resolve<ShopModuleService>(SHOP_MODULE)
  }

  private saleSnapshotService() {
    return this.scope.resolve<SaleSnapshotModuleService>(SALE_SNAPSHOT_MODULE)
  }

  private locationService() {
    return this.scope.resolve<ShopLocationModuleService>(SHOP_LOCATION_MODULE)
  }

  private taxInvoiceService() {
    return this.scope.resolve<TaxInvoiceModuleService>(TAX_INVOICE_MODULE)
  }

  private vatReturnService() {
    return this.scope.resolve<VatReturnModuleService>(VAT_RETURN_MODULE)
  }

  private inputVatRecordService() {
    return this.scope.resolve<InputVatRecordModuleService>(INPUT_VAT_RECORD_MODULE)
  }

  private taxReportService() {
    return this.scope.resolve<TaxReportModuleService>(TAX_REPORT_MODULE)
  }

  private taxReportRunService() {
    return this.scope.resolve<TaxReportRunModuleService>(TAX_REPORT_RUN_MODULE)
  }

  async getShop(shopId: string) {
    const [shops] = await this.shopService().listAndCountShops({ id: shopId }, { take: 1 })
    return (shops[0] as Dict | undefined) ?? null
  }

  shapeTaxSettings(shop: Dict): TaxSettingsRecord {
    return {
      shop_id: shop.id,
      shop_name: shop.shop_name,
      location_id: null,
      location_name: null,
      is_branch_override: false,
      kra_pin: shop.kra_pin ?? null,
      vat_registered: shop.vat_registered === true,
      vat_registration_number: shop.vat_registration_number ?? null,
      tax_type: toText(shop.tax_type, "exempt"),
      turnover_threshold: toNumber(shop.turnover_threshold),
      tims_enabled: shop.tims_enabled === true,
      tims_device_id: shop.tims_device_id ?? null,
      etr_serial_number: shop.etr_serial_number ?? null,
      invoice_prefix: toText(shop.invoice_prefix, "INV"),
      invoice_number_sequence: toNumber(shop.invoice_number_sequence, 1),
      tax_invoice_enabled: shop.tax_invoice_enabled === true,
      whvat_applicable: shop.whvat_applicable === true,
      whvat_registration: shop.whvat_registration ?? null,
      tax_reporting_email: shop.tax_reporting_email ?? null,
      last_vat_return_filed: shop.last_vat_return_filed ?? null,
      last_vat_return_period: shop.last_vat_return_period ?? null,
    }
  }

  private locationTaxSettings(location: Dict | null) {
    const metadata =
      location && typeof location.metadata === "object" && location.metadata !== null
        ? (location.metadata as Dict)
        : null
    const taxSettings =
      metadata && typeof metadata.tax_settings === "object" && metadata.tax_settings !== null
        ? (metadata.tax_settings as Dict)
        : null

    return {
      metadata,
      taxSettings,
    }
  }

  async getLocation(shopId: string, locationId: string) {
    const [locations] = await this.locationService().listAndCountShopLocations(
      { id: locationId, shop_id: shopId },
      { take: 1 }
    )
    return (locations[0] as Dict | undefined) ?? null
  }

  async getEffectiveTaxContext(shopId: string, locationId?: string | null): Promise<EffectiveTaxContext> {
    const shop = await this.getShop(shopId)
    if (!shop) {
      throw new Error("Shop not found")
    }

    const location = locationId ? await this.getLocation(shopId, locationId) : null
    const base = this.shapeTaxSettings(shop)
    const { taxSettings } = this.locationTaxSettings(location)

    if (!location || !taxSettings) {
      return {
        shop,
        location,
        settings: base,
      }
    }

    return {
      shop,
      location,
      settings: {
        ...base,
        location_id: typeof location.id === "string" ? location.id : null,
        location_name: typeof location.name === "string" ? location.name : null,
        is_branch_override: true,
        kra_pin: taxSettings.kra_pin ?? base.kra_pin,
        vat_registered: hasOwnEntry(taxSettings, "vat_registered")
          ? taxSettings.vat_registered === true
          : base.vat_registered,
        vat_registration_number:
          taxSettings.vat_registration_number ?? base.vat_registration_number,
        tax_type: toText(taxSettings.tax_type, base.tax_type),
        turnover_threshold: toNumber(taxSettings.turnover_threshold, base.turnover_threshold),
        tims_enabled: hasOwnEntry(taxSettings, "tims_enabled")
          ? taxSettings.tims_enabled === true
          : base.tims_enabled,
        tims_device_id: taxSettings.tims_device_id ?? base.tims_device_id,
        etr_serial_number: taxSettings.etr_serial_number ?? base.etr_serial_number,
        invoice_prefix: toText(taxSettings.invoice_prefix, base.invoice_prefix),
        invoice_number_sequence: toNumber(
          taxSettings.invoice_number_sequence,
          base.invoice_number_sequence
        ),
        tax_invoice_enabled: hasOwnEntry(taxSettings, "tax_invoice_enabled")
          ? taxSettings.tax_invoice_enabled === true
          : base.tax_invoice_enabled,
        whvat_applicable: hasOwnEntry(taxSettings, "whvat_applicable")
          ? taxSettings.whvat_applicable === true
          : base.whvat_applicable,
        whvat_registration: taxSettings.whvat_registration ?? base.whvat_registration,
        tax_reporting_email: taxSettings.tax_reporting_email ?? base.tax_reporting_email,
        last_vat_return_filed:
          taxSettings.last_vat_return_filed ?? base.last_vat_return_filed,
        last_vat_return_period:
          taxSettings.last_vat_return_period ?? base.last_vat_return_period,
      },
    }
  }

  async updateBranchTaxSettings(shopId: string, locationId: string, patch: Dict) {
    const location = await this.getLocation(shopId, locationId)
    if (!location) {
      throw new Error("Location not found")
    }

    const { metadata, taxSettings } = this.locationTaxSettings(location)
    const nextMetadata: Dict = {
      ...(metadata ?? {}),
      tax_settings: {
        ...(taxSettings ?? {}),
        ...patch,
      },
    }

    await this.locationService().updateShopLocations({
      id: locationId,
      metadata: nextMetadata,
    } as Dict)

    return this.getEffectiveTaxContext(shopId, locationId)
  }

  resolveVatRate(shop: Dict, overrideRate?: number) {
    if (typeof overrideRate === "number" && overrideRate >= 0) {
      return overrideRate
    }
    if (shop.tax_type === "vat" && shop.vat_registered === true) {
      return 16
    }
    return 0
  }

  async findSaleSnapshot(shopId: string, saleId: string) {
    const [snapshots] = await this.saleSnapshotService().listAndCountSaleSnapshots(
      {
        shop_id: shopId,
        order_id: saleId,
      },
      { take: 1, order: { timestamp: "DESC" } }
    )
    return (snapshots[0] as Dict | undefined) ?? null
  }

  async nextInvoiceNumber(shop: Dict) {
    const year = new Date().getUTCFullYear()
    const sequence = Math.max(1, toNumber(shop.invoice_number_sequence, 1))
    return `${toText(shop.invoice_prefix, "INV")}-${year}-${String(sequence).padStart(6, "0")}`
  }

  private async incrementInvoiceSequence(context: EffectiveTaxContext) {
    const nextSequence = Math.max(1, context.settings.invoice_number_sequence) + 1
    if (context.location) {
      await this.updateBranchTaxSettings(
        String(context.shop.id),
        String(context.location.id),
        {
          invoice_number_sequence: nextSequence,
          last_vat_return_period: context.settings.last_vat_return_period,
          last_vat_return_filed: context.settings.last_vat_return_filed,
        }
      )
      return
    }

    await this.shopService().updateShops([
      {
        id: String(context.shop.id),
        invoice_number_sequence: nextSequence,
      },
    ])
  }

  buildQrCodeData(invoice: Dict, shop: Dict) {
    return JSON.stringify({
      pin: shop.kra_pin ?? null,
      invoice: invoice.invoice_number,
      date: invoice.invoice_date,
      total: toNumber(invoice.total_amount),
      vat: toNumber(invoice.vat_amount),
      tims: shop.tims_enabled === true ? "enabled" : "offline",
    })
  }

  async transmitToTims(
    shop: Dict,
    invoice: Dict
  ): Promise<{
    status: "pending" | "accepted" | "rejected" | "transmitted"
    reactCode: string | null
    invoiceId: string | null
    reason: string | null
  }> {
    if (shop.tims_enabled !== true) {
      return {
        status: "pending",
        reactCode: null,
        invoiceId: null,
        reason: "TIMS disabled for this shop",
      }
    }

    return {
      status: "accepted",
      reactCode: "000",
      invoiceId: `tims_${String(invoice.id)}`,
      reason: null,
    }
  }

  async generateInvoiceForSale(input: {
    shopId: string
    saleId: string
    customerPin?: string | null
    customerName?: string | null
    customerAddress?: string | null
    customerVatNumber?: string | null
    invoiceType?: string | null
    createdBy?: string | null
    vatRate?: number | null
    locationId?: string | null
  }) {
    const snapshot = await this.findSaleSnapshot(input.shopId, input.saleId)
    if (!snapshot) {
      throw new Error("Sale not found")
    }
    const context = await this.getEffectiveTaxContext(
      input.shopId,
      input.locationId ??
          (typeof snapshot.location_id === "string" ? snapshot.location_id : null)
    )
    const shop = context.shop
    const settings = context.settings

    const [existingInvoices] = await this.taxInvoiceService().listAndCountTaxInvoices(
      {
        shop_id: input.shopId,
        sale_id: input.saleId,
        status: ["issued", "transmitted", "accepted"],
      } as Dict,
      { take: 1, order: { created_at: "DESC" } }
    )
    const existing = existingInvoices[0] as Dict | undefined
    if (existing) {
      return existing
    }

    const totalAmount = toNumber(snapshot.amount_paid ?? snapshot.price_charged)
    const vatRate =
      typeof input.vatRate === "number"
          ? input.vatRate
          : settings.tax_type == "vat" && settings.vat_registered
              ? 16
              : 0
    const divisor = vatRate > 0 ? 1 + vatRate / 100 : 1
    const subtotal = vatRate > 0 ? roundMoney(totalAmount / divisor) : roundMoney(totalAmount)
    const vatAmount = vatRate > 0 ? roundMoney(totalAmount - subtotal) : 0
    const withholdingVat = settings.whvat_applicable ? roundMoney(totalAmount * 0.02) : 0
    const invoiceNumber = `${settings.invoice_prefix}-${new Date().getUTCFullYear()}-${String(
      Math.max(1, settings.invoice_number_sequence)
    ).padStart(6, "0")}`
    const invoiceType =
      totalAmount > 10000 || (settings.vat_registered && settings.tax_type == "vat")
        ? "tax_invoice"
        : input.invoiceType ?? "simplified_invoice"

    const invoice = (await this.taxInvoiceService().createTaxInvoices({
      id: `tin_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      invoice_number: invoiceNumber,
      invoice_type: invoiceType,
      shop_id: input.shopId,
      sale_id: input.saleId,
      tims_enabled: settings.tims_enabled,
      supplier_kra_pin: settings.kra_pin ?? null,
      supplier_name: toText(shop.shop_name, "UZA Shop"),
      supplier_address: shop.address ?? null,
      supplier_vat_number: settings.vat_registration_number ?? null,
      customer_kra_pin: input.customerPin ?? null,
      customer_name: input.customerName ?? null,
      customer_address: input.customerAddress ?? null,
      customer_vat_number: input.customerVatNumber ?? null,
      subtotal,
      discount_amount: 0,
      taxable_amount: subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      withholding_vat_amount: withholdingVat,
      excise_duty_amount: 0,
      total_amount: totalAmount,
      vat_breakdown: [
        {
          rate: vatRate,
          taxable: subtotal,
          vat: vatAmount,
        },
      ],
      items: [
        {
          description: `Sale ${input.saleId}`,
          quantity: toNumber(snapshot.quantity_sold, 1),
          unit_price: toNumber(snapshot.price_charged),
          vat_rate: vatRate,
          vat_amount: vatAmount,
          total: totalAmount,
        },
      ],
      payment_status: "paid",
      payment_method: snapshot.payment_method ?? null,
      payment_date: snapshot.timestamp ?? new Date(),
      invoice_date: new Date(),
      supply_date: snapshot.timestamp ?? new Date(),
      status: "issued",
      created_by: input.createdBy ?? null,
    } as Dict)) as Dict

    const tims = await this.transmitToTims(settings as unknown as Dict, invoice)
    const qrCodeData = this.buildQrCodeData(
      invoice,
      {
        ...shop,
        kra_pin: settings.kra_pin,
        tims_enabled: settings.tims_enabled,
      }
    )
    const updatedInvoice = (await this.taxInvoiceService().updateTaxInvoices({
      id: String(invoice.id),
      tims_invoice_id: tims.invoiceId,
      tims_react_code: tims.reactCode,
      tims_transmission_status: tims.status,
      tims_transmitted_at: settings.tims_enabled ? new Date() : null,
      tims_accepted_at: tims.status === "accepted" ? new Date() : null,
      tims_rejection_reason: tims.reason,
      qr_code_data: qrCodeData,
      status: tims.status === "accepted" ? "accepted" : "issued",
    } as Dict)) as Dict

    await this.incrementInvoiceSequence(context)

    return updatedInvoice
  }

  shapeInvoice(invoice: Dict) {
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_type: invoice.invoice_type,
      sale_id: invoice.sale_id,
      status: invoice.status,
      tims_enabled: invoice.tims_enabled === true,
      tims_status: invoice.tims_transmission_status,
      tims_react_code: invoice.tims_react_code ?? null,
      customer_kra_pin: invoice.customer_kra_pin ?? null,
      customer_name: invoice.customer_name ?? null,
      subtotal: toNumber(invoice.subtotal),
      taxable_amount: toNumber(invoice.taxable_amount),
      vat_rate: toNumber(invoice.vat_rate),
      vat_amount: toNumber(invoice.vat_amount),
      withholding_vat_amount: toNumber(invoice.withholding_vat_amount),
      total_amount: toNumber(invoice.total_amount),
      payment_method: invoice.payment_method ?? null,
      invoice_date: invoice.invoice_date ?? null,
      supply_date: invoice.supply_date ?? null,
      qr_code_data: invoice.qr_code_data ?? null,
      original_invoice_number: invoice.original_invoice_number ?? null,
      credit_note_reason: invoice.credit_note_reason ?? null,
    }
  }

  async ensureInputVatRecordForRestock(input: {
    shopId: string
    restockId: string
    supplierName?: string | null
    supplierInvoiceDate?: Date | null
    totalCost: number
    receiptImageUrl?: string | null
    supplierKraPin?: string | null
    supplierVatNumber?: string | null
    purchaseOrderId?: string | null
  }) {
    const [existing] = await this.inputVatRecordService().listAndCountInputVatRecords(
      { shop_id: input.shopId, restock_id: input.restockId },
      { take: 1 }
    )
    if (existing[0]) {
      return existing[0] as Dict
    }

    const purchaseAmount = roundMoney(input.totalCost / 1.16)
    const vatAmount = roundMoney(input.totalCost - purchaseAmount)

    return (await this.inputVatRecordService().createInputVatRecords({
      id: `ivr_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shopId,
      purchase_order_id: input.purchaseOrderId ?? null,
      restock_id: input.restockId,
      supplier_invoice_number: `RESTOCK-${input.restockId.slice(-8).toUpperCase()}`,
      supplier_invoice_date: input.supplierInvoiceDate ?? new Date(),
      supplier_kra_pin: input.supplierKraPin ?? null,
      supplier_name: toText(input.supplierName, "Supplier"),
      supplier_vat_number: input.supplierVatNumber ?? null,
      purchase_amount: purchaseAmount,
      vat_rate: 16,
      vat_amount: vatAmount,
      total_amount: roundMoney(input.totalCost),
      invoice_image_url: input.receiptImageUrl ?? null,
      invoice_verified: false,
    } as Dict)) as Dict
  }

  shapeInputVatRecord(record: Dict) {
    return {
      id: record.id,
      restock_id: record.restock_id ?? null,
      supplier_invoice_number: record.supplier_invoice_number,
      supplier_invoice_date: record.supplier_invoice_date ?? null,
      supplier_name: record.supplier_name,
      purchase_amount: toNumber(record.purchase_amount),
      vat_rate: toNumber(record.vat_rate),
      vat_amount: toNumber(record.vat_amount),
      total_amount: toNumber(record.total_amount),
      vat_claimed: record.vat_claimed === true,
      vat_claim_period: record.vat_claim_period ?? null,
      invoice_image_url: record.invoice_image_url ?? null,
    }
  }

  async createCreditNoteForReturn(input: {
    shopId: string
    originalSaleId?: string | null
    returnId: string
    refundAmount: number
    reason?: string | null
    createdBy?: string | null
  }) {
    if (!input.originalSaleId) {
      return null
    }
    const [invoices] = await this.taxInvoiceService().listAndCountTaxInvoices(
      {
        shop_id: input.shopId,
        sale_id: input.originalSaleId,
      },
      { take: 1, order: { created_at: "ASC" } }
    )
    const original = invoices[0] as Dict | undefined
    if (!original) {
      return null
    }

    const [existingCredit] = await this.taxInvoiceService().listAndCountTaxInvoices(
      {
        shop_id: input.shopId,
        sale_id: `credit:${input.returnId}`,
      },
      { take: 1 }
    )
    if (existingCredit[0]) {
      return existingCredit[0] as Dict
    }

    const context = await this.getEffectiveTaxContext(input.shopId)
    const shop = context.shop
    const settings = context.settings
    const invoiceNumber = `${settings.invoice_prefix}-${new Date().getUTCFullYear()}-${String(
      Math.max(1, settings.invoice_number_sequence)
    ).padStart(6, "0")}`
    const vatRate = toNumber(original.vat_rate)
    const divisor = vatRate > 0 ? 1 + vatRate / 100 : 1
    const subtotal = vatRate > 0 ? roundMoney(input.refundAmount / divisor) : roundMoney(input.refundAmount)
    const vatAmount = vatRate > 0 ? roundMoney(input.refundAmount - subtotal) : 0

    const creditNote = (await this.taxInvoiceService().createTaxInvoices({
      id: `tcn_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      invoice_number: invoiceNumber,
      invoice_type: "credit_note",
      shop_id: input.shopId,
      sale_id: `credit:${input.returnId}`,
      tims_enabled: settings.tims_enabled,
      supplier_kra_pin: settings.kra_pin ?? null,
      supplier_name: toText(shop.shop_name, "UZA Shop"),
      supplier_address: shop.address ?? null,
      supplier_vat_number: settings.vat_registration_number ?? null,
      customer_kra_pin: original.customer_kra_pin ?? null,
      customer_name: original.customer_name ?? null,
      subtotal: -subtotal,
      taxable_amount: -subtotal,
      vat_rate: vatRate,
      vat_amount: -vatAmount,
      total_amount: -roundMoney(input.refundAmount),
      items: [
        {
          description: `Credit note for return ${input.returnId}`,
          quantity: 1,
          unit_price: -roundMoney(input.refundAmount),
          vat_rate: vatRate,
          vat_amount: -vatAmount,
          total: -roundMoney(input.refundAmount),
        },
      ],
      payment_status: "credit",
      payment_method: original.payment_method ?? null,
      payment_date: new Date(),
      invoice_date: new Date(),
      supply_date: new Date(),
      original_invoice_number: original.invoice_number ?? null,
      credit_note_reason: input.reason ?? "Return refund processed",
      status: "issued",
      created_by: input.createdBy ?? null,
    } as Dict)) as Dict

    await this.incrementInvoiceSequence(context)

    return creditNote
  }

  async generateVatReturn(input: {
    shopId: string
    period: string
    includeDraft?: boolean
    createdBy?: string | null
    locationId?: string | null
  }) {
    const { start, end } = monthBounds(input.period)
    const context = await this.getEffectiveTaxContext(input.shopId, input.locationId ?? null)
    const shop = context.shop
    const settings = context.settings

    const invoiceStatuses = input.includeDraft ? ["draft", "issued", "transmitted", "accepted"] : ["issued", "transmitted", "accepted"]
    const [invoices] = await this.taxInvoiceService().listAndCountTaxInvoices(
      {
        shop_id: input.shopId,
        invoice_date: { $gte: start, $lte: end },
        status: invoiceStatuses,
      } as Dict,
      { take: 10000, order: { invoice_date: "ASC" } }
    )
    const [inputRecords] = await this.inputVatRecordService().listAndCountInputVatRecords(
      {
        shop_id: input.shopId,
        supplier_invoice_date: { $gte: start, $lte: end },
      } as Dict,
      { take: 10000, order: { supplier_invoice_date: "ASC" } }
    )

    let standardRatedSales = 0
    let standardRatedVat = 0
    let reducedRatedSales = 0
    let reducedRatedVat = 0
    let zeroRatedSales = 0
    let exemptSales = 0
    let withholdingVatSuffered = 0

    for (const raw of invoices as Dict[]) {
      const invoice = raw as Dict
      const taxableAmount = toNumber(invoice.taxable_amount)
      const vatAmount = toNumber(invoice.vat_amount)
      const vatRate = toNumber(invoice.vat_rate)
      withholdingVatSuffered += Math.max(0, toNumber(invoice.withholding_vat_amount))

      if (String(invoice.invoice_type) === "credit_note") {
        if (vatRate === 16) {
          standardRatedSales += taxableAmount
          standardRatedVat += vatAmount
        } else if (vatRate === 8) {
          reducedRatedSales += taxableAmount
          reducedRatedVat += vatAmount
        } else if (vatRate === 0) {
          zeroRatedSales += taxableAmount
        } else {
          exemptSales += taxableAmount
        }
        continue
      }

      if (vatRate === 16) {
        standardRatedSales += taxableAmount
        standardRatedVat += vatAmount
      } else if (vatRate === 8) {
        reducedRatedSales += taxableAmount
        reducedRatedVat += vatAmount
      } else if (vatRate === 0 && taxableAmount > 0) {
        zeroRatedSales += taxableAmount
      } else {
        exemptSales += taxableAmount
      }
    }

    let standardRatedPurchases = 0
    let standardRatedInputVat = 0
    let capitalGoodsInputVat = 0
    const supportingDocuments: Array<Record<string, unknown>> = []

    for (const raw of inputRecords as Dict[]) {
      const record = raw as Dict
      if (record.vat_disallowed === true) {
        continue
      }
      const purchaseAmount = toNumber(record.purchase_amount)
      const vatAmount = toNumber(record.vat_amount)
      standardRatedPurchases += purchaseAmount
      standardRatedInputVat += vatAmount
      if (purchaseAmount >= 100000) {
        capitalGoodsInputVat += vatAmount
      }
      supportingDocuments.push({
        id: record.id,
        supplier_invoice_number: record.supplier_invoice_number,
        supplier_name: record.supplier_name,
        total_amount: toNumber(record.total_amount),
      })
    }

    const totalOutputVat = roundMoney(standardRatedVat + reducedRatedVat)
    const totalInputVat = roundMoney(standardRatedInputVat)
    const vatPayable = Math.max(0, roundMoney(totalOutputVat - totalInputVat - withholdingVatSuffered))
    const vatRefundable = totalInputVat + withholdingVatSuffered > totalOutputVat
      ? roundMoney(totalInputVat + withholdingVatSuffered - totalOutputVat)
      : 0

    const payload = {
      standard_rated_sales: roundMoney(standardRatedSales),
      standard_rated_vat: roundMoney(standardRatedVat),
      reduced_rated_sales: roundMoney(reducedRatedSales),
      reduced_rated_vat: roundMoney(reducedRatedVat),
      zero_rated_sales: roundMoney(zeroRatedSales),
      exempt_sales: roundMoney(exemptSales),
      total_output_vat: totalOutputVat,
      standard_rated_purchases: roundMoney(standardRatedPurchases),
      standard_rated_input_vat: roundMoney(standardRatedInputVat),
      capital_goods_input_vat: roundMoney(capitalGoodsInputVat),
      total_input_vat: totalInputVat,
      withholding_vat_suffered: roundMoney(withholdingVatSuffered),
      vat_payable: vatPayable,
      vat_refundable: vatRefundable,
      supporting_documents: supportingDocuments,
    }

    const [existing] = await this.vatReturnService().listAndCountVatReturns(
      { shop_id: input.shopId, return_period: input.period },
      { take: 1 }
    )
    const current = existing[0] as Dict | undefined
    const record = current
      ? ((await this.vatReturnService().updateVatReturns({
          id: String(current.id),
          kra_pin: typeof settings.kra_pin === "string" ? settings.kra_pin : null,
          ...payload,
          status: "draft",
        } as Dict)) as Dict)
      : ((await this.vatReturnService().createVatReturns({
          id: `vat_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
          return_period: input.period,
          shop_id: input.shopId,
          kra_pin: typeof settings.kra_pin === "string" ? settings.kra_pin : null,
          ...payload,
          status: "draft",
        } as Dict)) as Dict)

    if (context.location) {
      await this.updateBranchTaxSettings(input.shopId, String(context.location.id), {
        last_vat_return_period: input.period,
      })
    } else {
      await this.shopService().updateShops([
        {
          id: input.shopId,
          last_vat_return_period: input.period,
        },
      ])
    }

    await this.taxReportService().createTaxReports({
      id: `trp_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      report_type: settings.tax_type === "turnover_tax" ? "turnover_tax" : "vat_summary",
      report_period: input.period,
      shop_id: input.shopId,
      report_data: payload,
      export_format: "csv",
      kra_submission_ready: true,
      kra_submission_format: "KRA_VAT3_CSV",
      status: "generated",
      generated_at: new Date(),
      generated_by: input.createdBy ?? null,
    } as Dict)

    await this.taxReportRunService().createTaxReportRuns({
      id: `tax_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      shop_id: input.shopId,
      report_type: settings.tax_type === "turnover_tax" ? "income" : "vat",
      branch_scope: null,
      period_start: start,
      period_end: end,
      vat_rate_percent: 16,
      status: "completed",
      payload: {
        period: input.period,
        gross_sales: roundMoney(standardRatedSales + reducedRatedSales + zeroRatedSales + exemptSales),
        taxable_sales: roundMoney(standardRatedSales + reducedRatedSales),
        tax_due: settings.tax_type === "turnover_tax"
          ? roundMoney((standardRatedSales + reducedRatedSales + zeroRatedSales + exemptSales) * 0.03)
          : vatPayable,
        vat_return_id: record.id,
      },
      generated_by: input.createdBy ?? null,
      generated_at: new Date(),
    } as Dict)

    return record
  }

  shapeVatReturn(record: Dict) {
    return {
      id: record.id,
      return_period: record.return_period,
      kra_pin: record.kra_pin ?? null,
      standard_rated_sales: toNumber(record.standard_rated_sales),
      standard_rated_vat: toNumber(record.standard_rated_vat),
      reduced_rated_sales: toNumber(record.reduced_rated_sales),
      reduced_rated_vat: toNumber(record.reduced_rated_vat),
      zero_rated_sales: toNumber(record.zero_rated_sales),
      exempt_sales: toNumber(record.exempt_sales),
      total_output_vat: toNumber(record.total_output_vat),
      standard_rated_purchases: toNumber(record.standard_rated_purchases),
      standard_rated_input_vat: toNumber(record.standard_rated_input_vat),
      capital_goods_input_vat: toNumber(record.capital_goods_input_vat),
      total_input_vat: toNumber(record.total_input_vat),
      withholding_vat_suffered: toNumber(record.withholding_vat_suffered),
      vat_payable: toNumber(record.vat_payable),
      vat_refundable: toNumber(record.vat_refundable),
      status: record.status,
      payment_status: record.payment_status,
      filed_at: record.filed_at ?? null,
      supporting_documents: Array.isArray(record.supporting_documents) ? record.supporting_documents : [],
      created_at: record.created_at ?? null,
    }
  }

  buildVatReturnCsv(record: Dict) {
    const rows = [
      ["Section", "Field", "Value"],
      ["A", "Return Period", toText(record.return_period)],
      ["A", "KRA PIN", toText(record.kra_pin)],
      ["A", "Standard Rated Sales", String(toNumber(record.standard_rated_sales))],
      ["A", "Standard Rated VAT", String(toNumber(record.standard_rated_vat))],
      ["A", "Reduced Rated Sales", String(toNumber(record.reduced_rated_sales))],
      ["A", "Reduced Rated VAT", String(toNumber(record.reduced_rated_vat))],
      ["A", "Zero Rated Sales", String(toNumber(record.zero_rated_sales))],
      ["A", "Exempt Sales", String(toNumber(record.exempt_sales))],
      ["A", "Total Output VAT", String(toNumber(record.total_output_vat))],
      ["B", "Standard Rated Purchases", String(toNumber(record.standard_rated_purchases))],
      ["B", "Standard Rated Input VAT", String(toNumber(record.standard_rated_input_vat))],
      ["B", "Capital Goods Input VAT", String(toNumber(record.capital_goods_input_vat))],
      ["B", "Total Input VAT", String(toNumber(record.total_input_vat))],
      ["C", "Withholding VAT Suffered", String(toNumber(record.withholding_vat_suffered))],
      ["C", "VAT Payable", String(toNumber(record.vat_payable))],
      ["C", "VAT Refundable", String(toNumber(record.vat_refundable))],
    ]

    return rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
  }

  async getDashboard(shopId: string, locationId?: string | null) {
    const context = await this.getEffectiveTaxContext(shopId, locationId ?? null)
    const shop = context.shop

    const [invoices, vatReturns, inputVatRecords, reports] = await Promise.all([
      this.taxInvoiceService().listAndCountTaxInvoices({ shop_id: shopId }, { take: 10, order: { created_at: "DESC" } }),
      this.vatReturnService().listAndCountVatReturns({ shop_id: shopId }, { take: 6, order: { created_at: "DESC" } }),
      this.inputVatRecordService().listAndCountInputVatRecords({ shop_id: shopId }, { take: 10, order: { created_at: "DESC" } }),
      this.taxReportService().listAndCountTaxReports({ shop_id: shopId }, { take: 10, order: { created_at: "DESC" } }),
    ])

    const invoiceList = (invoices[0] as Dict[]).map((entry) => this.shapeInvoice(entry))
    const vatReturnList = (vatReturns[0] as Dict[]).map((entry) => this.shapeVatReturn(entry))
    const inputVatList = (inputVatRecords[0] as Dict[]).map((entry) => this.shapeInputVatRecord(entry))
    const reportsList = (reports[0] as Dict[]).map((entry) => ({
      id: entry.id,
      report_type: entry.report_type,
      report_period: entry.report_period,
      status: entry.status,
      generated_at: entry.generated_at ?? null,
      export_format: entry.export_format,
    }))

    const latestVatReturn = vatReturnList[0] ?? null
    const latestInvoice = invoiceList[0] ?? null

    return {
      settings: context.settings,
      summary: {
        invoices_issued: invoiceList.length,
        tims_ready: context.settings.tims_enabled,
        pending_tims: invoiceList.filter((entry) => entry.tims_status !== "accepted").length,
        latest_invoice_number: latestInvoice?.invoice_number ?? null,
        latest_vat_payable: latestVatReturn?.vat_payable ?? 0,
        latest_vat_refundable: latestVatReturn?.vat_refundable ?? 0,
        latest_return_period: latestVatReturn?.return_period ?? null,
        input_vat_pool: roundMoney(inputVatList.reduce((sum, entry) => sum + toNumber(entry.vat_amount), 0)),
      },
      invoices: invoiceList,
      vat_returns: vatReturnList,
      input_vat_records: inputVatList,
      reports: reportsList,
    }
  }
}
