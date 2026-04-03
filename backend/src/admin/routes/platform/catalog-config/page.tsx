import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import {
  adminRequest,
  type CatalogConfigResponse,
} from "../../../lib/platform-admin"

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2)

const CatalogConfigPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [path, setPath] = useState("")
  const [version, setVersion] = useState("")
  const [rawJson, setRawJson] = useState("")
  const [error, setError] = useState<string | null>(null)

  const parsedPreview = useMemo(() => {
    try {
      return JSON.parse(rawJson) as Record<string, unknown>
    } catch {
      return null
    }
  }, [rawJson])

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await adminRequest<CatalogConfigResponse>(
        "/admin/platform/catalog-config"
      )
      setPath(response.path)
      setVersion(response.catalog.version ?? "")
      setRawJson(prettyJson(response.catalog))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog config")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const save = async () => {
    let parsed: Record<string, unknown>

    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>
    } catch {
      toast.error("Catalog config JSON is invalid")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await adminRequest<CatalogConfigResponse>(
        "/admin/platform/catalog-config",
        {
          method: "PATCH",
          body: JSON.stringify({ catalog: parsed }),
        }
      )
      setPath(response.path)
      setVersion(response.catalog.version ?? "")
      setRawJson(prettyJson(response.catalog))
      toast.success("Catalog config saved")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save catalog config"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading level="h1">Catalog Config</Heading>
          <Text className="text-ui-fg-subtle">
            Manage industries and categories from one JSON definition used by onboarding,
            branch setup, and product forms.
          </Text>
        </div>
        <Button variant="secondary" asChild>
          <Link to="/platform">Back to Platform Admin</Link>
        </Button>
      </div>

      <Container className="p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Config File</Label>
            <Input readOnly value={path} />
          </div>
          <div>
            <Label>Version</Label>
            <Input readOnly value={version} />
          </div>
        </div>
        <Text size="small" className="mt-3 text-ui-fg-subtle">
          Add new industries, children, categories, or default features here. No backend
          code changes are needed after save.
        </Text>
      </Container>

      <Container className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <Heading level="h2">JSON Editor</Heading>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void load()} isLoading={loading}>
              Reload
            </Button>
            <Button onClick={() => void save()} isLoading={saving || loading}>
              Save Config
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-ui-border-error bg-ui-bg-error p-4">
            <Text>{error}</Text>
          </div>
        ) : null}

        <Textarea
          rows={28}
          value={rawJson}
          onChange={(event) => setRawJson(event.target.value)}
          className="font-mono"
          disabled={loading}
        />
      </Container>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Container className="p-5">
          <Heading level="h2">Preview</Heading>
          <Text size="small" className="mt-2 text-ui-fg-subtle">
            {parsedPreview
              ? `${Array.isArray(parsedPreview.industries) ? parsedPreview.industries.length : 0} industries`
              : "Preview unavailable until JSON is valid."}
          </Text>
        </Container>
        <Container className="p-5 xl:col-span-2">
          <Heading level="h2">Rules</Heading>
          <div className="mt-3 flex flex-col gap-2">
            <Text size="small" className="text-ui-fg-subtle">
              Use lowercase slugs like <code>fashion_retail</code> or <code>electronics_components</code>.
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Parent industries can set <code>selectable: false</code> and expose subtypes through
              <code>children</code>.
            </Text>
            <Text size="small" className="text-ui-fg-subtle">
              Category availability and supplier tags are inherited from parent industries.
            </Text>
          </div>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Catalog Config",
})

export default CatalogConfigPage
