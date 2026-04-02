import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { adminRequest } from "../../lib/platform-admin"
import type { ExportLogRecord } from "../../lib/partner-admin"

type LogsResponse = {
  logs: ExportLogRecord[]
}

type ReportResponse = {
  report: {
    total_exports: number
    total_rows_exported: number
    consent_compliance_rate: number
    aggregation_compliance_rate: number
  }
}

const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const CompliancePage = () => {
  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [logs, setLogs] = useState<ExportLogRecord[]>([])
  const [report, setReport] = useState<ReportResponse["report"] | null>(null)
  const [loading, setLoading] = useState(true)

  const loadComplianceData = async () => {
    setLoading(true)
    try {
      const [logsResponse, reportResponse] = await Promise.all([
        adminRequest<LogsResponse>(
          `/partners/admin/logs?start_date=${startDate}&end_date=${endDate}`
        ),
        adminRequest<ReportResponse>(
          `/partners/admin/compliance-report?start_date=${startDate}&end_date=${endDate}`
        ),
      ])
      setLogs(logsResponse.logs)
      setReport(reportResponse.report)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load compliance data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadComplianceData()
  }, [])

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">Compliance</Heading>
        <Text className="text-ui-fg-subtle">
          Review ODPC-oriented partner export logs, thresholds, and consent compliance.
        </Text>
      </div>

      <Container className="p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <Button onClick={() => void loadComplianceData()} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </Container>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Container className="p-5">
          <Text size="small" className="text-ui-fg-subtle">Exports</Text>
          <Heading level="h2">{report?.total_exports ?? 0}</Heading>
        </Container>
        <Container className="p-5">
          <Text size="small" className="text-ui-fg-subtle">Rows Exported</Text>
          <Heading level="h2">{report?.total_rows_exported ?? 0}</Heading>
        </Container>
        <Container className="p-5">
          <Text size="small" className="text-ui-fg-subtle">Consent Compliance</Text>
          <Heading level="h2">{Math.round(report?.consent_compliance_rate ?? 0)}%</Heading>
        </Container>
        <Container className="p-5">
          <Text size="small" className="text-ui-fg-subtle">Aggregation Compliance</Text>
          <Heading level="h2">{Math.round(report?.aggregation_compliance_rate ?? 0)}%</Heading>
        </Container>
      </div>

      <Container className="p-0">
        <div className="p-5">
          <Heading level="h2">Audit Log</Heading>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Partner</Table.HeaderCell>
              <Table.HeaderCell>Dataset</Table.HeaderCell>
              <Table.HeaderCell>Rows</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Compliance</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading logs...</Table.Cell>
                <Table.Cell /><Table.Cell /><Table.Cell /><Table.Cell />
              </Table.Row>
            ) : (
              logs.map((log) => (
                <Table.Row key={log.id}>
                  <Table.Cell>{log.partner_id}</Table.Cell>
                  <Table.Cell>{log.data_type}</Table.Cell>
                  <Table.Cell>{log.result_row_count}</Table.Cell>
                  <Table.Cell>
                    <Badge color={log.status === "completed" ? "green" : "orange"}>
                      {log.status}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <Badge color={log.consent_verified ? "blue" : "red"}>
                        consent
                      </Badge>
                      <Badge color={log.aggregation_threshold_met ? "green" : "red"}>
                        threshold
                      </Badge>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Compliance",
})

export default CompliancePage
