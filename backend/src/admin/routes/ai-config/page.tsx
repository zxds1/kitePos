import { useEffect, useMemo, useState, type ReactNode } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
} from "@medusajs/ui"
import { adminRequest } from "../../lib/platform-admin"

type AIConfigResponse = {
  success: boolean
  config: null | {
    id: string
    litellm_base_url: string
    default_provider: string
    default_model: string
    provider_options: string[]
    model_options: string[]
    fallback_models: string[]
    max_tokens_per_day: number
    max_cost_per_day: number
    preferred_tier: string
    chatbot_enabled: boolean
    chatbot_personality: string
    chatbot_language: string
    inventory_ai_enabled: boolean
    pricing_ai_enabled: boolean
    marketing_ai_enabled: boolean
    analytics_ai_enabled: boolean
    escalation_rules: Record<string, unknown>
    total_tokens_used: number
    total_cost: number
  }
}

const AIConfigPage = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    litellm_base_url: "http://localhost:4000",
    default_provider: "openai",
    default_model: "gpt-4o-mini",
    provider_options: "openai, anthropic, google, azure, local",
    model_options: "gpt-4o-mini, gpt-3.5-turbo, claude-3-haiku, gemini-1.5-flash",
    fallback_models: "gpt-4o-mini, claude-3-haiku",
    max_tokens_per_day: "10000",
    max_cost_per_day: "50",
    preferred_tier: "budget",
    chatbot_enabled: true,
    chatbot_personality: "friendly",
    chatbot_language: "both",
    inventory_ai_enabled: true,
    pricing_ai_enabled: true,
    marketing_ai_enabled: true,
    analytics_ai_enabled: true,
    min_confidence: "0.5",
    contacts: "",
  })
  const [usage, setUsage] = useState({
    total_tokens_used: 0,
    total_cost: 0,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const response = await adminRequest<AIConfigResponse>("/admin/ai-config")
        const config = response.config
        if (config) {
          setForm({
            litellm_base_url: config.litellm_base_url,
            default_provider: config.default_provider,
            default_model: config.default_model,
            provider_options: (config.provider_options ?? []).join(", "),
            model_options: (config.model_options ?? []).join(", "),
            fallback_models: (config.fallback_models ?? []).join(", "),
            max_tokens_per_day: String(config.max_tokens_per_day ?? 10000),
            max_cost_per_day: String(config.max_cost_per_day ?? 50),
            preferred_tier: config.preferred_tier ?? "budget",
            chatbot_enabled: config.chatbot_enabled !== false,
            chatbot_personality: config.chatbot_personality ?? "friendly",
            chatbot_language: config.chatbot_language ?? "both",
            inventory_ai_enabled: config.inventory_ai_enabled !== false,
            pricing_ai_enabled: config.pricing_ai_enabled !== false,
            marketing_ai_enabled: config.marketing_ai_enabled !== false,
            analytics_ai_enabled: config.analytics_ai_enabled !== false,
            min_confidence: String(
              config.escalation_rules?.["min_confidence"] ?? 0.5
            ),
            contacts: Array.isArray(config.escalation_rules?.["contacts"])
              ? (config.escalation_rules?.["contacts"] as string[]).join(", ")
              : "",
          })
          setUsage({
            total_tokens_used: config.total_tokens_used ?? 0,
            total_cost: config.total_cost ?? 0,
          })
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const usageTone = useMemo(() => {
    const cost = Number(form.max_cost_per_day || "0")
    if (cost <= 0) {
      return "grey"
    }
    return usage.total_cost >= cost ? "red" : usage.total_cost >= cost * 0.8 ? "orange" : "green"
  }, [form.max_cost_per_day, usage.total_cost])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await adminRequest<AIConfigResponse>("/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({
          scope: "platform",
          litellm_base_url: form.litellm_base_url,
          default_provider: form.default_provider,
          default_model: form.default_model,
          provider_options: form.provider_options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          model_options: form.model_options
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          fallback_models: form.fallback_models
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          max_tokens_per_day: Number(form.max_tokens_per_day || "10000"),
          max_cost_per_day: Number(form.max_cost_per_day || "50"),
          preferred_tier: form.preferred_tier,
          chatbot_enabled: form.chatbot_enabled,
          chatbot_personality: form.chatbot_personality,
          chatbot_language: form.chatbot_language,
          inventory_ai_enabled: form.inventory_ai_enabled,
          pricing_ai_enabled: form.pricing_ai_enabled,
          marketing_ai_enabled: form.marketing_ai_enabled,
          analytics_ai_enabled: form.analytics_ai_enabled,
          escalation_rules: {
            min_confidence: Number(form.min_confidence || "0.5"),
            contacts: form.contacts
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          },
        }),
      })
      setMessage("AI configuration saved")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-6">
      <div>
        <Heading level="h1">AI Configuration</Heading>
        <Text className="text-ui-fg-subtle">
          Control platform-wide LiteLLM routing, budget limits, escalation rules, and shop-ops AI features.
        </Text>
      </div>

      <Container className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <Heading level="h2">Usage This Month</Heading>
          <Badge color={usageTone as "grey" | "green" | "orange" | "red"}>
            KES {usage.total_cost.toFixed(2)}
          </Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-ui-border-base p-4">
            <Text size="small" className="text-ui-fg-subtle">Tokens Used</Text>
            <Heading level="h2">{usage.total_tokens_used.toLocaleString()}</Heading>
          </div>
          <div className="rounded-lg border border-ui-border-base p-4">
            <Text size="small" className="text-ui-fg-subtle">Cost Limit / Day</Text>
            <Heading level="h2">KES {form.max_cost_per_day}</Heading>
          </div>
        </div>
      </Container>

      <Container className="p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="LiteLLM Base URL">
            <Input
              value={form.litellm_base_url}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  litellm_base_url: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Default Provider">
            <Input
              value={form.default_provider}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  default_provider: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Default Model">
            <Input
              value={form.default_model}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  default_model: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Allowed Providers">
            <Textarea
              value={form.provider_options}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  provider_options: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Allowed Models">
            <Textarea
              value={form.model_options}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  model_options: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Fallback Models">
            <Textarea
              value={form.fallback_models}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fallback_models: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Max Tokens Per Day">
            <Input
              type="number"
              value={form.max_tokens_per_day}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  max_tokens_per_day: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Max Cost Per Day (KES)">
            <Input
              type="number"
              value={form.max_cost_per_day}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  max_cost_per_day: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Preferred Tier">
            <Select
              value={form.preferred_tier}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, preferred_tier: value }))
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {["budget", "balanced", "premium"].map((value) => (
                  <Select.Item key={value} value={value}>
                    {value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <Field label="Min Confidence Threshold">
            <Input
              type="number"
              value={form.min_confidence}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  min_confidence: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Escalation Contacts">
            <Textarea
              value={form.contacts}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contacts: event.target.value,
                }))
              }
            />
          </Field>
          <Field label="Chatbot Personality">
            <Select
              value={form.chatbot_personality}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, chatbot_personality: value }))
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {["friendly", "professional", "casual", "formal"].map((value) => (
                  <Select.Item key={value} value={value}>
                    {value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
          <Field label="Chatbot Language">
            <Select
              value={form.chatbot_language}
              onValueChange={(value) =>
                setForm((current) => ({ ...current, chatbot_language: value }))
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {["en", "sw", "both"].map((value) => (
                  <Select.Item key={value} value={value}>
                    {value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Toggle
            label="Enable chatbot"
            checked={form.chatbot_enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, chatbot_enabled: checked }))
            }
          />
          <Toggle
            label="Inventory AI"
            checked={form.inventory_ai_enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, inventory_ai_enabled: checked }))
            }
          />
          <Toggle
            label="Pricing AI"
            checked={form.pricing_ai_enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, pricing_ai_enabled: checked }))
            }
          />
          <Toggle
            label="Marketing AI"
            checked={form.marketing_ai_enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, marketing_ai_enabled: checked }))
            }
          />
          <Toggle
            label="Analytics AI"
            checked={form.analytics_ai_enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, analytics_ai_enabled: checked }))
            }
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={save} isLoading={saving || loading}>
            Save Configuration
          </Button>
          {message ? <Text>{message}</Text> : null}
        </div>
      </Container>
    </div>
  )
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <div className="flex flex-col gap-2">
    <Label>{label}</Label>
    {children}
  </div>
)

const Toggle = ({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) => (
  <div className="flex items-center justify-between rounded-lg border border-ui-border-base p-4">
    <Text>{label}</Text>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
)

export const config = defineRouteConfig({
  label: "AI Config",
})

export default AIConfigPage
