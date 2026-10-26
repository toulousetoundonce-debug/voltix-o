module.exports = {
  content: ["./public/achievements.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Cairo", "Tajawal", "sans-serif"],
        mono: ["JetBrains Mono", "Inter", "monospace"],
        ltr: ["Inter", "sans-serif"],
      },
      colors: {
        voltix: {
          navy: "#0a192f",
          slate: "#0f172a",
          lightNavy: "#112240",
          blue: "#1d4ed8",
          accent: "#2563eb",
          sky: "#0284c7",
          surface: "#f8fafc",
          border: "#e2e8f0",
        },
      },
      boxShadow: {
        corporate:
          "0 4px 20px -2px rgba(10, 25, 47, 0.06), 0 2px 6px -1px rgba(10, 25, 47, 0.04)",
        "corporate-lg":
          "0 20px 35px -5px rgba(10, 25, 47, 0.12), 0 8px 15px -6px rgba(10, 25, 47, 0.06)",
      },
    },
  },
  plugins: [],
};
