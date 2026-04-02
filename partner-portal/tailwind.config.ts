import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1728",
        sand: "#f3efe4",
        ember: "#d97706",
        moss: "#1f6d4f"
      }
    }
  },
  plugins: []
}

export default config
