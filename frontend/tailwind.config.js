/**
 * Konfiguracja Tailwind CSS dla aplikacji TruthScan AI.
 *
 * Zawiera:
 * - ścieżki do plików objętych analizą klas (content),
 * - obsługę trybu ciemnego przez klasę `.dark`,
 * - mapowanie zmiennych CSS na kolory Tailwind,
 * - definicje fontów globalnych,
 * - safelistę klas używanych dynamicznie.
 */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  safelist: [
    "bg-background",
    "text-foreground",
    "dark:bg-background",
    "dark:text-foreground",
    "bg-card",
    "text-muted",
    "border",
    "dark:border",
  ],
  plugins: [],
};


