import type { Config } from "tailwindcss";

// Paleta inspirada en Villa Altagracia: el verde de sus lomas, el sol de la
// mañana sobre la Autopista Duarte y el tono arena de sus calles.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monte: {
          50: "#eef6f0",
          100: "#d5eadb",
          200: "#aed5ba",
          300: "#7fb993",
          400: "#4f9a6c",
          500: "#2f7d51",
          600: "#226541",
          700: "#1c5136",
          800: "#17402c",
          900: "#123224",
          950: "#0a1f16",
        },
        sol: {
          50: "#fff7eb",
          100: "#fdebcb",
          200: "#fad493",
          300: "#f6b85a",
          400: "#f29e33",
          500: "#e7831a",
          600: "#c96612",
          700: "#a34d13",
          800: "#843e16",
          900: "#6c3415",
        },
        arena: {
          50: "#fdfbf7",
          100: "#faf6ef",
          200: "#f3ecdf",
          300: "#e8dcc6",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        suave: "0 1px 2px rgb(28 25 23 / 0.04), 0 8px 24px -12px rgb(28 25 23 / 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
