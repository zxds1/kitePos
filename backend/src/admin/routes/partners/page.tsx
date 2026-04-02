import { useEffect, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Badge, Button, Container, Heading, Input, Label, Select, Table, Text, Textarea, toast } from "@medusajs/ui"
import { adminRequest } from "../../lib/platform-admin"
import type { AdminPartnerRecord } from "../../lib/partner-admin"

type PartnerListResponse = {
  partners: AdminPartnerRecord[]
}

type CreatePartnerResponse = {
  partner: AdminPartnerRecord
  api_key: string
}

const defaultForm = {
  name: "",
  contact_email: "",
  contact_phone: "",
  company_registration: "",
  billing_tier: "basic",
  billing_email: "",
  regions: "NAI",
  data_types: "sales,products",
  rate_limit: "100",
  quota_monthly: "10000",
}

const PartnersPage = () => {
  const [partners, setPartners] = useState<AdminPartnerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [latestApiKey, setLatestApiKey] = useState<string | null>(null)

  const loadPartners = async () => {
    setLoading(true)
    try {
      const response = await adminRequest<PartnerListResponse>("/partners/admin/partners")
      setPartners(response.partners)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load partners")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPartners()
  }, [])

  const createPartner = async () => {
    setSubmitting(true)
    try {
      const response = await adminRequest<CreatePartnerResponse>("/partners/admin/create", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone || undefined,
          company_registration: form.company_registration || undefined,
          billing_tier: form.billing_tier,
          billing_email: form.billing_email,
          permissions: {
            regions: form.regions.split(",").map((item) => item.trim()).filter(Boolean),
            data_types: form.data_types
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          },
          rate_limit: Number(form.rate_limit),
          quota_monthly: Number(form.quota_monthly),
        }),
      })
      setLatestApiKey(response.api_key)
      setForm(defaultForm)
      toast.success("Partner created")
      await loadPartners()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create partner")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">Partners</Heading>
        <Text className="text-ui-fg-subtle">
          Create and manage external insight partners without exposing admin or POS data paths.
        </Text>
      </div>

      <Container className="p-5">
        <Heading level="h2">Create Partner</Heading>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Contact Email</Label>
            <Input
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
          </div>
          <div>
            <Label>Billing Email</Label>
            <Input
              value={form.billing_email}
              onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
            />
          </div>
          <div>
            <Label>Billing Tier</Label>
            <Select value={form.billing_tier} onValueChange={(value) => setForm({ ...form, billing_tier: value })}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="free">Free</Select.Item>
                <Select.Item value="basic">Basic</Select.Item>
                <Select.Item value="premium">Premium</Select.Item>
                <Select.Item value="enterprise">Enterprise</Select.Item>
              </Select.Content>
            </Select>
          </div>
          <div>
            <Label>Rate Limit / Hour</Label>
            <Input value={form.rate_limit} onChange={(e) => setForm({ ...form, rate_limit: e.target.value })} />
          </div>
          <div>
            <Label>Monthly Quota</Label>
            <Input
              value={form.quota_monthly}
              onChange={(e) => setForm({ ...form, quota_monthly: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Allowed Regions</Label>
            <Textarea
              rows={2}
              value={form.regions}
              onChange={(e) => setForm({ ...form, regions: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Allowed Data Types</Label>
            <Textarea
              rows={2}
              value={form.data_types}
              onChange={(e) => setForm({ ...form, data_types: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={() => void createPartner()} isLoading={submitting}>
            Create Partner
          </Button>
          {latestApiKey ? (
            <Text size="small" className="text-ui-fg-subtle">
              Latest API key: <code>{latestApiKey}</code>
            </Text>
          ) : null}
        </div>
      </Container>

      <Container className="p-0">
        <div className="p-5">
          <Heading level="h2">Partner Directory</Heading>
        </div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Tier</Table.HeaderCell>
              <Table.HeaderCell>Quota</Table.HeaderCell>
              <Table.HeaderCell>Usage</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell>Loading partners...</Table.Cell>
                <Table.Cell /><Table.Cell /><Table.Cell /><Table.Cell />
              </Table.Row>
            ) : (
              partners.map((partner) => (
                <Table.Row key={partner.id}>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span>{partner.name}</span>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {partner.contact_email}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{partner.billing_tier}</Table.Cell>
                  <Table.Cell>{partner.quota_monthly}</Table.Cell>
                  <Table.Cell>
                    {partner.quota_used} / {partner.quota_monthly}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <Badge color={partner.is_active ? "green" : "red"}>
                        {partner.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge color={partner.is_verified ? "blue" : "orange"}>
                        {partner.is_verified ? "Verified" : "Pending"}
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
  label: "Partners",
})

export default PartnersPage
