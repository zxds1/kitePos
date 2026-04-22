import fs from "node:fs"
import path from "node:path"

export type CatalogCategory = {
  slug: string
  label: string
}

export type CatalogIndustry = {
  slug: string
  label: string
  selectable?: boolean
  helper?: string
  supplier_categories?: string[]
  category_slugs?: string[]
  default_features?: Record<string, unknown>
  children?: CatalogIndustry[]
}

export type CatalogConfig = {
  version: string
  industries: CatalogIndustry[]
  categories: CatalogCategory[]
}

const SLUG_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/
const VIRTUAL_INDUSTRY_TYPES = new Set(["custom_setup"])

function ensureSlug(value: unknown, field: string): string {
  const slug = String(value ?? "").trim()
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${field} must be a lowercase slug`)
  }
  return slug
}

function normalizeCategory(input: Record<string, unknown>): CatalogCategory {
  return {
    slug: ensureSlug(input.slug, "category.slug"),
    label: String(input.label ?? input.slug),
  }
}

function normalizeIndustry(input: Record<string, unknown>): CatalogIndustry {
  const children = Array.isArray(input.children)
    ? input.children.map((entry) =>
        normalizeIndustry(entry as Record<string, unknown>)
      )
    : []

  return {
    slug: ensureSlug(input.slug, "industry.slug"),
    label: String(input.label ?? input.slug),
    selectable: input.selectable !== false,
    helper:
      typeof input.helper === "string" && input.helper.trim().length > 0
        ? input.helper.trim()
        : undefined,
    supplier_categories: Array.isArray(input.supplier_categories)
      ? input.supplier_categories.map((entry) => String(entry).trim()).filter(Boolean)
      : [],
    category_slugs: Array.isArray(input.category_slugs)
      ? input.category_slugs.map((entry) => ensureSlug(entry, "industry.category_slugs"))
      : [],
    default_features:
      input.default_features &&
      typeof input.default_features === "object" &&
      !Array.isArray(input.default_features)
        ? (input.default_features as Record<string, unknown>)
        : {},
    children,
  }
}

function normalizeConfig(raw: Record<string, unknown>): CatalogConfig {
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((entry) =>
        normalizeCategory(entry as Record<string, unknown>)
      )
    : []
  const industries = Array.isArray(raw.industries)
    ? raw.industries.map((entry) =>
        normalizeIndustry(entry as Record<string, unknown>)
      )
    : []

  return {
    version: String(raw.version ?? new Date().toISOString().slice(0, 10)),
    industries,
    categories,
  }
}

function resolveCatalogConfigPath() {
  const configuredPath = process.env.POS_CATALOG_CONFIG_PATH
  const defaultPath = path.resolve(process.cwd(), "config", "catalog-config.json")
  return configuredPath && configuredPath.trim().length > 0
    ? configuredPath
    : defaultPath
}

function loadConfigFromDisk(): CatalogConfig {
  const filePath = resolveCatalogConfigPath()

  const content = fs.readFileSync(filePath, "utf8")
  const parsed = JSON.parse(content) as Record<string, unknown>
  return normalizeConfig(parsed)
}

export function getCatalogConfig(): CatalogConfig {
  return loadConfigFromDisk()
}

export function flattenIndustries(config: CatalogConfig = getCatalogConfig()) {
  const flattened = new Map<
    string,
    CatalogIndustry & { parent_slug: string | null; inherited_features: Record<string, unknown>; supplier_tags: string[]; category_keys: string[] }
  >()

  const visit = (
    industry: CatalogIndustry,
    parent: CatalogIndustry | null,
    inheritedFeatures: Record<string, unknown>,
    inheritedSupplierTags: string[],
    inheritedCategoryKeys: string[]
  ) => {
    const mergedFeatures = {
      ...inheritedFeatures,
      ...(industry.default_features ?? {}),
    }
    const mergedTags = Array.from(
      new Set([...(inheritedSupplierTags ?? []), ...(industry.supplier_categories ?? [])])
    )
    const mergedCategoryKeys = Array.from(
      new Set([...(inheritedCategoryKeys ?? []), ...(industry.category_slugs ?? [])])
    )

    flattened.set(industry.slug, {
      ...industry,
      parent_slug: parent?.slug ?? null,
      inherited_features: mergedFeatures,
      supplier_tags: mergedTags,
      category_keys: mergedCategoryKeys,
    })

    for (const child of industry.children ?? []) {
      visit(child, industry, mergedFeatures, mergedTags, mergedCategoryKeys)
    }
  }

  for (const industry of config.industries) {
    visit(industry, null, {}, [], [])
  }

  return flattened
}

export function validateIndustryTypes(industryTypes: string[]) {
  const allowed = flattenIndustries()
  const normalized = Array.from(
    new Set(
      industryTypes.map((entry) => ensureSlug(entry, "industry_type")).filter(Boolean)
    )
  )
  const unknown = normalized.filter(
    (entry) => !allowed.has(entry) && !VIRTUAL_INDUSTRY_TYPES.has(entry)
  )

  return {
    normalized,
    unknown,
  }
}

export function mergeIndustryFeatures(industryTypes: string[]) {
  const allowed = flattenIndustries()
  return industryTypes.reduce<Record<string, unknown>>((acc, slug) => {
    if (VIRTUAL_INDUSTRY_TYPES.has(slug)) {
      return acc
    }

    const industry = allowed.get(slug)
    if (!industry) {
      return acc
    }

    return {
      ...acc,
      ...industry.inherited_features,
    }
  }, {})
}

export function industrySupplierCategories(industryTypes: string[]) {
  const allowed = flattenIndustries()
  const derived = new Set<string>()
  for (const slug of industryTypes) {
    if (VIRTUAL_INDUSTRY_TYPES.has(slug)) {
      continue
    }

    const industry = allowed.get(slug)
    if (!industry) {
      derived.add(slug.replaceAll("_", " "))
      continue
    }

    for (const tag of industry.supplier_tags) {
      derived.add(tag)
    }
  }

  return Array.from(derived)
}

export function categoryOptionsForIndustries(industryTypes: string[]) {
  const config = getCatalogConfig()
  const categoryMap = new Map(config.categories.map((entry) => [entry.slug, entry]))
  const allowed = flattenIndustries(config)
  const categoryKeys = new Set<string>()

  for (const slug of industryTypes) {
    const industry = allowed.get(slug)
    if (!industry) {
      continue
    }
    for (const key of industry.category_keys) {
      categoryKeys.add(key)
    }
  }

  if (categoryKeys.size === 0) {
    for (const category of config.categories) {
      categoryKeys.add(category.slug)
    }
  }

  return Array.from(categoryKeys)
    .map((key) => categoryMap.get(key))
    .filter((entry): entry is CatalogCategory => Boolean(entry))
}

export function toCatalogPayload(config: CatalogConfig = getCatalogConfig()) {
  return {
    version: config.version,
    industries: config.industries,
    categories: config.categories,
  }
}

export function parseCatalogConfig(raw: Record<string, unknown>) {
  return normalizeConfig(raw)
}

export function getCatalogConfigPath() {
  return resolveCatalogConfigPath()
}

export function saveCatalogConfig(raw: Record<string, unknown>) {
  const normalized = normalizeConfig(raw)
  const filePath = resolveCatalogConfigPath()
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8")
  return normalized
}
