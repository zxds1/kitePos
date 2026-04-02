import { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Select, Text, toast } from "@medusajs/ui"
import { adminRequest, downloadBlob } from "../../../lib/platform-admin"

const defaultEnd = new Date().toISOString().slice(0, 10)
const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const ExportPage = () => {
  const [exportType, setExportType] = useState("shops")
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await adminRequest<Blob>("/admin/data-export", {
        method: "POST",
        body: JSON.stringify({
          export_type: exportType,
          start_date: startDate,
          end_date: endDate,
          format: "csv",
        }),
      })

      downloadBlob(blob, `${exportType}-${startDate}-${endDate}.csv`)
      toast.success("Export downloaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">Data Export</Heading>
        <Text className="text-ui-fg-subtle">
          Export admin-approved datasets for analysis without exposing them to POS users.
        </Text>
      </div>

      <Container className="max-w-2xl p-5">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Text size="small" className="mb-2 text-ui-fg-subtle">
              Export type
            </Text>
            <Select value={exportType} onValueChange={setExportType}>
              <Select.Trigger>
                <Select.Value placeholder="Choose dataset" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="shops">Shops</Select.Item>
                <Select.Item value="sales">Sales</Select.Item>
              </Select.Content>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Text size="small" className="mb-2 text-ui-fg-subtle">
                Start date
              </Text>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <Text size="small" className="mb-2 text-ui-fg-subtle">
                End date
              </Text>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>

          <Button onClick={() => void handleExport()} isLoading={loading}>
            Download CSV
          </Button>
        </div>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Platform Exports",
})

export default ExportPage
