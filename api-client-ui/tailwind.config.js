/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#b6d8ff",
          300: "#8bc0ff",
          400: "#5b9fff",
          500: "#3b82f6",
          600: "#2667dc",
          700: "#1e4fae",
          800: "#1c3f88",
          900: "#172f65",
        },
        game: {
          bg: "rgb(var(--color-game-bg) / <alpha-value>)",
          panel: "rgb(var(--color-game-panel) / <alpha-value>)",
          elevated: "rgb(var(--color-game-elevated) / <alpha-value>)",
          line: "rgb(var(--color-game-line) / <alpha-value>)",
          accent: "rgb(var(--color-game-accent) / <alpha-value>)",
          glow: "rgb(var(--color-game-glow) / <alpha-value>)",
        },
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6", // Doctor Now Blue
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        secondary: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          raised: "rgb(var(--color-surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--color-surface-overlay) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-text) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-text-subtle) / <alpha-value>)",
          inverse: "rgb(var(--color-text-inverse) / <alpha-value>)",
        },
        line: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong) / <alpha-value>)",
        },
        control: {
          DEFAULT: "rgb(var(--color-control) / <alpha-value>)",
          hover: "rgb(var(--color-control-hover) / <alpha-value>)",
        },
        focus: "rgb(var(--color-focus) / <alpha-value>)",
      },
      borderRadius: {
        panel: "var(--radius-panel)",
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        modal: "var(--radius-modal)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
        modal: "var(--shadow-modal)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
