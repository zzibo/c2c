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
        // Pixel Art Color Palette
        'pixel-cream': '#f5e6d3',
        'pixel-dark': '#2a2420',
        'pixel-copper': '#d4823f',
        'pixel-brown': '#8b6f47',
        'pixel-terracotta': '#c9956a',
        'pixel-text-dark': '#5a4a42',
        'pixel-text-light': '#f5e6d3',
        'pixel-beige': '#faf4ed',
      },
      fontFamily: {
        'pixel': ['Press Start 2P', 'cursive'],
        'mono': ['Courier New', 'Courier', 'monospace'],
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
