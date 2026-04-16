import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { adminRequest, type ObservabilityResponse } from "../../../lib/platform-admin"

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const ObservabilityPage = () => {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ObservabilityResponse | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const response = await adminRequest<ObservabilityResponse>(
        "/admin/platform/observability"
      )
      setData(response)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load observability"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const summary = data?.summary
  const alerts = data?.alerts ?? []

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading level="h1">Observability</Heading>
          <Text className="text-ui-fg-subtle">
            Admin-only telemetry for AI operations, audit events, and system alerts.
          </Text>
        </div>
        <Button variant="secondary" onClick={() => void load()} isLoading={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "AI Operations",
            value: summary?.ai_operations_24h ?? 0,
            meta: "Last 24 hours",
          },
          {
            label: "AI Failures",
            value: summary?.ai_failures_24h ?? 0,
            meta: `${summary?.ai_slow_ops_24h ?? 0} slow ops`,
          },
          {
            label: "Tokens / Cost",
            value: `${summary?.total_tokens_24h ?? 0} / KES ${(
              summary?.total_cost_kes_24h ?? 0
            ).toFixed(2)}`,
            meta: "Last 24 hours",
          },
          {
            label: "Audit Events",
            value: summary?.audit_events_24h ?? 0,
            meta: `${summary?.alert_count ?? 0} active alerts`,
          },
        ].map((item) => (
          <Container key={item.label} className="p-5">
            <Text size="small" className="text-ui-fg-subtle">
              {item.label}
            </Text>
            <Heading level="h2" className="mt-2">
              {item.value}
            </Heading>
            <Text size="small" className="mt-2 text-ui-fg-subtle">
              {item.meta}
            </Text>
          </Container>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Container className="xl:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <Heading level="h2">Operational Alerts</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              High-signal failures and risky actions
            </Text>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Time</Table.HeaderCell>
                <Table.HeaderCell>Source</Table.HeaderCell>
                <Table.HeaderCell>Severity</Table.HeaderCell>
                <Table.HeaderCell>Message</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loading ? (
                <Table.Row>
                  <Table.Cell>Loading alerts...</Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              ) : alerts.length === 0 ? (
                <Table.Row>
                  <Table.Cell>No alerts</Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              ) : (
                alerts.map((alert) => (
                  <Table.Row key={alert.id}>
                    <Table.Cell>{formatDateTime(alert.occurred_at)}</Table.Cell>
                    <Table.Cell>{alert.source}</Table.Cell>
                    <Table.Cell>
                      <Badge
                        color={
                          alert.severity === "critical"
                            ? "red"
                            : alert.severity === "warning"
                              ? "orange"
                              : "blue"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-1">
                        <Text className="font-medium">{alert.title}</Text>
                        <Text size="small" className="text-ui-fg-subtle">
                          {alert.message}
                        </Text>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
          </Table>
        </Container>

        <Container className="p-5">
          <Heading level="h2">System Health</Heading>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Text>API</Text>
              <Badge color="green">{summary?.system_health.api_status ?? "healthy"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <Text>Database</Text>
              <Badge color="green">
                {summary?.system_health.database_status ?? "healthy"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Text>Checked</Text>
              <Text size="small" className="text-ui-fg-subtle">
                {summary?.system_health.checked_at
                  ? formatDateTime(summary.system_health.checked_at)
                  : "-"}
              </Text>
            </div>
          </div>
        </Container>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Container className="p-0">
          <div className="flex items-center justify-between p-5">
            <Heading level="h2">Recent AI Operations</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Latest model activity and failures
            </Text>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Operation</Table.HeaderCell>
                <Table.HeaderCell>Latency</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.recent_ai_operations ?? []).slice(0, 10).map((entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <Text className="font-medium">{entry.operation_type}</Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        {entry.provider} / {entry.model}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{entry.latency_ms} ms</Table.Cell>
                  <Table.Cell>
                    <Badge color={entry.success ? "green" : "red"}>
                      {entry.success ? "ok" : "failed"}
                    </Badge>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>

        <Container className="p-0">
          <div className="flex items-center justify-between p-5">
            <Heading level="h2">Recent Audit Activity</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Protective actions and admin changes
            </Text>
          </div>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Action</Table.HeaderCell>
                <Table.HeaderCell>Entity</Table.HeaderCell>
                <Table.HeaderCell>Time</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.recent_audit_events ?? []).slice(0, 10).map((entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell>{entry.action}</Table.Cell>
                  <Table.Cell>{entry.entity_type}</Table.Cell>
                  <Table.Cell>{formatDateTime(entry.created_at)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Observability",
})

export default ObservabilityPage
