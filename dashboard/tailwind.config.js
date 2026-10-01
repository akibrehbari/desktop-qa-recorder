/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // eLeopards Technologies brand theme (shared across eLeopards apps).
        // Dark, high-contrast base with a single electric accent (brand green).
        background: "oklch(0.16 0.004 250)",
        foreground: "oklch(0.97 0.005 250)",
        surface: "oklch(0.21 0.006 250)",
        card: "oklch(0.20 0.006 250)",
        primary: {
          DEFAULT: "oklch(0.6271 0.1699 149.21)", // #16A34A
          foreground: "oklch(0.98 0.005 150)",
        },
        muted: {
          DEFAULT: "oklch(0.24 0.006 250)",
          foreground: "oklch(0.72 0.012 250)",
        },
        accent: {
          DEFAULT: "oklch(0.28 0.02 149.21)",
          foreground: "oklch(0.9 0.1 149.21)",
        },
        destructive: {
          DEFAULT: "oklch(0.62 0.21 25)",
          foreground: "oklch(0.98 0.01 250)",
        },
        border: "oklch(1 0 0 / 12%)",
        ring: "oklch(0.6271 0.1699 149.21 / 60%)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 0 0 oklch(1 0 0 / 0.06) inset, 0 20px 40px -24px oklch(0 0 0 / 0.8)",
        glow: "0 18px 50px -20px color-mix(in oklab, oklch(0.6271 0.1699 149.21) 45%, transparent)",
      },
    },
  },
  plugins: [],
};
