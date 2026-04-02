import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Select, Table, Text, toast } from "@medusajs/ui"
import {
  adminRequest,
  buildQuery,
  formatCurrency,
  type ProductAnalyticsResponse,
  type RevenueResponse,
} from "../../../lib/platform-admin"

const defaultEnd = new Date().toISOString().slice(0, 10)
const defaultStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const AnalyticsPage = () => {
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [groupBy, setGroupBy] = useState("day")
  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null)
  const [products, setProducts] = useState<ProductAnalyticsResponse["top_products"]>([])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [revenueResponse, productResponse] = await Promise.all([
        adminRequest<RevenueResponse>(
          `/admin/analytics/revenue${buildQuery({
            start_date: startDate,
            end_date: endDate,
            group_by: groupBy,
          })}`
        ),
        adminRequest<ProductAnalyticsResponse>(
          `/admin/analytics/products${buildQuery({
            start_date: startDate,
            end_date: endDate,
            limit: 10,
          })}`
        ),
      ])

      setRevenue(revenueResponse)
      setProducts(productResponse.top_products)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load analytics")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [])

  const maxRevenue = Math.max(...(revenue?.trends ?? []).map((entry) => entry.revenue), 1)

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">Analytics</Heading>
        <Text className="text-ui-fg-subtle">
          Cross-shop analytics from protected admin aggregates only.
        </Text>
      </div>

      <Container className="p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Select value={groupBy} onValueChange={setGroupBy}>
            <Select.Trigger>
              <Select.Value placeholder="Group by" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="day">Day</Select.Item>
              <Select.Item value="week">Week</Select.Item>
              <Select.Item value="month">Month</Select.Item>
            </Select.Content>
          </Select>
          <Button onClick={() => void loadAnalytics()} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </Container>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Container className="p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <Heading level="h2">Revenue</Heading>
            <Badge color="blue">{groupBy}</Badge>
          </div>
          {loading ? (
            <Text className="text-ui-fg-subtle">Loading revenue analytics...</Text>
          ) : (
            <div className="flex items-end gap-3">
              {(revenue?.trends ?? []).map((entry) => (
                <div key={entry.bucket} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded bg-ui-bg-subtle">
                    <div
                      className="rounded bg-ui-tag-blue-bg"
                      style={{
                        height: `${Math.max((entry.revenue / maxRevenue) * 220, 10)}px`,
                      }}
                    />
                  </div>
                  <Text size="xsmall">{entry.bucket}</Text>
                </div>
              ))}
            </div>
          )}
        </Container>

        <Container className="p-5">
          <Heading level="h2">Summary</Heading>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Text size="small" className="text-ui-fg-subtle">Revenue</Text>
              <Heading level="h3">
                {formatCurrency(revenue?.summary.total_revenue ?? 0)}
              </Heading>
            </div>
            <div>
              <Text size="small" className="text-ui-fg-subtle">Transactions</Text>
              <Heading level="h3">
                {revenue?.summary.total_transactions ?? 0}
              </Heading>
            </div>
            <div>
              <Text size="small" className="text-ui-fg-subtle">Average ticket</Text>
              <Heading level="h3">
                {formatCurrency(revenue?.summary.average_transaction_value ?? 0)}
              </Heading>
            </div>
          </div>
        </Container>
      </div>

      <Container className="p-0">
        <div className="p-5">
          <Heading level="h2">Top Products</Heading>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Product</Table.HeaderCell>
              <Table.HeaderCell>Units Sold</Table.HeaderCell>
              <Table.HeaderCell>Transactions</Table.HeaderCell>
              <Table.HeaderCell>Revenue</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {products.map((product) => (
              <Table.Row key={product.variant_id}>
                <Table.Cell>{product.product_name}</Table.Cell>
                <Table.Cell>{product.units_sold}</Table.Cell>
                <Table.Cell>{product.transaction_count}</Table.Cell>
                <Table.Cell>{formatCurrency(product.revenue)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Platform Analytics",
})

export default AnalyticsPage
