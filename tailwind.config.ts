import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./public/achievements.html"],
  theme: {
    extend: {
      colors: {
        "grid-dark": "#090D16",
        "page-bg": "rgb(var(--bg) / <alpha-value>)",
        "grid-card": "rgb(var(--surface-1) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        "electric-blue": "rgb(var(--electric) / <alpha-value>)",
        "sos-red": "rgb(var(--danger) / <alpha-value>)",
        "status-ok": "rgb(var(--ok) / <alpha-value>)",
        "status-warn": "rgb(var(--warn) / <alpha-value>)",
      },
      fontFamily: {
        cairo: ["Cairo", "Segoe UI", "Tahoma", "Arial", "sans-serif"],
        "plex-arabic": ["IBM Plex Sans Arabic", "Cairo", "Segoe UI", "Tahoma", "Arial", "sans-serif"],
      },
      boxShadow: {
        "glow-blue":
          "0 0 20px rgb(var(--electric) / 0.45), 0 0 48px rgb(var(--electric) / 0.2)",
        "glow-red":
          "0 0 20px rgb(var(--danger) / 0.55), 0 0 48px rgb(var(--danger) / 0.25)",
      },
      keyframes: {
        "sos-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 0 20px rgba(255,42,42,0.55), 0 0 0 0 rgba(255,42,42,0.55)",
          },
          "50%": {
            boxShadow:
              "0 0 38px rgba(255,42,42,0.85), 0 0 0 16px rgba(255,42,42,0)",
          },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "sos-pulse": "sos-pulse 1.8s ease-in-out infinite",
        "modal-in": "modal-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
