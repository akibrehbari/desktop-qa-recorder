/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0b0f14",
        panel: "#121824",
        border: "#1f2836",
        accent: "#5eead4",
      },
    },
  },
  plugins: [],
};
