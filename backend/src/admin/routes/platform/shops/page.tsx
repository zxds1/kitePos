import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import {
  adminRequest,
  buildQuery,
  type ShopRecord,
} from "../../../lib/platform-admin"

type ShopsResponse = {
  shops: ShopRecord[]
}

const ShopsPage = () => {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [shops, setShops] = useState<ShopRecord[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadShops = async (term = search) => {
    setLoading(true)
    try {
      const response = await adminRequest<ShopsResponse>(
        `/admin/shops${buildQuery({
          limit: 100,
          search: term,
        })}`
      )
      setShops(response.shops)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load shops")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadShops("")
  }, [])

  const toggleShopStatus = async (shop: ShopRecord) => {
    setBusyId(shop.id)
    try {
      await adminRequest(`/admin/shops/${shop.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !shop.is_active }),
      })
      toast.success(
        `${shop.shop_name} ${shop.is_active ? "suspended" : "activated"} successfully`
      )
      await loadShops()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status update failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">Shop Management</Heading>
        <Text className="text-ui-fg-subtle">
          Review tenant status without exposing this dataset to POS or end-user routes.
        </Text>
      </div>

      <Container className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            placeholder="Search by shop, owner, region, ward, or category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void loadShops(search)}>
              Search
            </Button>
            <Button
              variant="transparent"
              onClick={() => {
                setSearch("")
                void loadShops("")
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      </Container>

      <Container className="p-0">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Shop</Table.HeaderCell>
              <Table.HeaderCell>Owner</Table.HeaderCell>
              <Table.HeaderCell>Location</Table.HeaderCell>
              <Table.HeaderCell>M-Pesa</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading shops...</Table.Cell>
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
              </Table.Row>
            ) : shops.length === 0 ? (
              <Table.Row>
                <Table.Cell>No shops matched the current filter.</Table.Cell>
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
                <Table.Cell />
              </Table.Row>
            ) : (
              shops.map((shop) => (
                <Table.Row key={shop.id}>
                  <Table.Cell>{shop.shop_name}</Table.Cell>
                  <Table.Cell>{shop.owner_name || "-"}</Table.Cell>
                  <Table.Cell>
                    {shop.region_code} / {shop.ward_code}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={shop.accept_mpesa ? "green" : "grey"}>
                      {shop.accept_mpesa ? "Enabled" : "Disabled"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={shop.is_active ? "green" : "red"}>
                      {shop.is_active ? "Active" : "Suspended"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="small"
                      variant={shop.is_active ? "secondary" : "primary"}
                      isLoading={busyId === shop.id}
                      onClick={() => void toggleShopStatus(shop)}
                    >
                      {shop.is_active ? "Suspend" : "Activate"}
                    </Button>
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
  label: "Platform Shops",
})

export default ShopsPage
