import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import {
  adminRequest,
  buildQuery,
  formatCurrency,
  formatDate,
  type OverviewResponse,
  type RevenueResponse,
} from "../../lib/platform-admin"

const rangeStart = () => {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString().slice(0, 10)
}

const DashboardPage = () => {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewResponse["overview"] | null>(null)
  const [trends, setTrends] = useState<RevenueResponse["trends"]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [overviewResponse, revenueResponse] = await Promise.all([
          adminRequest<OverviewResponse>("/admin/dashboard/overview"),
          adminRequest<RevenueResponse>(
            `/admin/analytics/revenue${buildQuery({
              start_date: rangeStart(),
              end_date: new Date().toISOString().slice(0, 10),
              group_by: "day",
            })}`
          ),
        ])

        setOverview(overviewResponse.overview)
        setTrends(revenueResponse.trends.slice(-7))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const maxRevenue = Math.max(...trends.map((entry) => entry.revenue), 1)

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Heading level="h1">Platform Admin</Heading>
          <Text className="text-ui-fg-subtle">
            Admin-only overview sourced exclusively from protected
            {" "}
            <code>/admin/*</code>
            {" "}
            endpoints.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/platform/shops">Manage Shops</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/platform/analytics">View Analytics</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/platform/exports">Export Data</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/platform/catalog-config">Catalog Config</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Shops",
            value: overview?.total_shops ?? 0,
            meta: `${overview?.active_shops ?? 0} active`,
          },
          {
            label: "30-Day Sales",
            value: overview?.total_sales ?? 0,
            meta: "Aggregated transactions",
          },
          {
            label: "30-Day Revenue",
            value: formatCurrency(overview?.total_revenue ?? 0),
            meta: "Protected admin aggregate",
          },
          {
            label: "M-Pesa Enabled",
            value: overview?.mpesa_enabled_shops ?? 0,
            meta: `${overview?.inactive_shops ?? 0} shops inactive`,
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Container className="xl:col-span-3 p-5">
          <div className="mb-4 flex items-center justify-between">
            <Heading level="h2">Revenue Trend</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Last 7 daily buckets
            </Text>
          </div>
          {loading ? (
            <Text className="text-ui-fg-subtle">Loading trend data...</Text>
          ) : (
            <div className="flex items-end gap-3">
              {trends.map((entry) => (
                <div key={entry.bucket} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded bg-ui-bg-subtle">
                    <div
                      className="rounded bg-ui-tag-blue-bg"
                      style={{
                        height: `${Math.max((entry.revenue / maxRevenue) * 180, 12)}px`,
                      }}
                    />
                  </div>
                  <Text size="xsmall">{entry.bucket.slice(5)}</Text>
                </div>
              ))}
            </div>
          )}
        </Container>

        <Container className="xl:col-span-2 p-5">
          <Heading level="h2">System Health</Heading>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Text>API</Text>
              <Badge color="green">{overview?.system_health.api_status ?? "healthy"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <Text>Database</Text>
              <Badge color="green">
                {overview?.system_health.database_status ?? "healthy"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <Text>Last checked</Text>
              <Text size="small" className="text-ui-fg-subtle">
                {overview?.system_health.checked_at
                  ? formatDate(overview.system_health.checked_at)
                  : "-"}
              </Text>
            </div>
            <div className="mt-2 rounded-lg border border-ui-border-base p-3">
              <Text size="small" className="text-ui-fg-subtle">
                Payment mix
              </Text>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(overview?.payment_breakdown ?? {}).map(([method, count]) => (
                  <Badge key={method} color="blue">
                    {method}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </div>

      <Container className="p-0">
        <div className="flex items-center justify-between p-5">
          <Heading level="h2">Recent Shops</Heading>
          <Button variant="secondary" asChild>
            <Link to="/platform/shops">Open shop oversight</Link>
          </Button>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Shop</Table.HeaderCell>
              <Table.HeaderCell>Region</Table.HeaderCell>
              <Table.HeaderCell>Ward</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Created</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(overview?.recent_shops ?? []).map((shop) => (
              <Table.Row key={shop.id}>
                <Table.Cell>{shop.shop_name}</Table.Cell>
                <Table.Cell>{shop.region_code}</Table.Cell>
                <Table.Cell>{shop.ward_code}</Table.Cell>
                <Table.Cell>
                  <Badge color={shop.is_active ? "green" : "red"}>
                    {shop.is_active ? "Active" : "Suspended"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{formatDate(shop.created_at)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Platform Admin",
})

export default DashboardPage
