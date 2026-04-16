import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function candidatePaths(relativePath: string) {
  return [
    resolve(process.cwd(), "src", "prompts", relativePath),
    resolve(process.cwd(), "backend", "src", "prompts", relativePath),
    resolve(__dirname, "..", "prompts", relativePath),
  ]
}

export function loadPrompt(relativePath: string, fallback: string) {
  for (const candidate of candidatePaths(relativePath)) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8").trim()
    }
  }

  return fallback.trim()
}

export function renderPrompt(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, value)
  }, template)
}
