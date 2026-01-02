import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // C2C brand colors (ONLY USE THESE)
        'c2c-base': '#f6f0e8',        // warm off-white backgrounds
        'c2c-orange': '#f4512c',      // primary accent (CTAs, highlights)
        'c2c-orange-dark': '#e64524', // hover/active states
      },
      fontFamily: {
        'sans': ['var(--font-roboto-mono)', 'sans-serif'],
        'pixel': ['Press Start 2P', 'cursive'],
        'mono': ['var(--font-roboto-mono)', 'monospace'],
      },
      boxShadow: {
        'pixel': '4px 4px 0 rgba(90, 74, 66, 0.15), 8px 8px 0 rgba(212, 130, 63, 0.1)',
        'pixel-sm': '2px 2px 0 rgba(90, 74, 66, 0.15), 4px 4px 0 rgba(212, 130, 63, 0.1)',
      },
      borderWidth: {
        '3': '3px',
        '4': '4px',
      },
    },
  },
  plugins: [],
};
export default config;
