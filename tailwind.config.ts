import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7688a2", // rgb(118 136 162)
          dark: "#5e6d82",
          light: "#a6b2c3",
        },
        ink: "#0f172a",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        // Pulsing red glow ring + a gentle background throb — "urgent" without a harsh blink.
        "urgent-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.6)", backgroundColor: "#dc2626" },
          "50%": { boxShadow: "0 0 0 7px rgba(220,38,38,0)", backgroundColor: "#ef4444" },
        },
      },
      animation: {
        "urgent-pulse": "urgent-pulse 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
