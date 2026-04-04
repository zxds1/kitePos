import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        trace: {
          ink: "#0E141B",
          deep: "#102330",
          blue: "#1E5D89",
          mist: "#EAF2F7",
          sand: "#F5F7F8",
          line: "#D7E0E7",
        },
      },
      boxShadow: {
        panel: "0 24px 80px rgba(16, 35, 48, 0.12)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
}

export default config
