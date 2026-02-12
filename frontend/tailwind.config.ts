import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FFFDFB",
          100: "#FFFBF5",
          200: "#FFF5E8",
          300: "#FFEDD5",
          400: "#FDE0B7",
          500: "#F9D49A",
        },
        warm: {
          50: "#FAFAF9",
          100: "#F5F5F4",
          200: "#E7E5E4",
          300: "#D6D3D1",
          400: "#A8A29E",
          500: "#78716C",
          600: "#57534E",
          700: "#44403C",
          800: "#292524",
          900: "#1C1917",
        },
        kitchly: {
          orange: "#F97316",
          "orange-light": "#FB923C",
          "orange-dark": "#EA580C",
          emerald: "#10B981",
          "emerald-light": "#34D399",
          "emerald-dark": "#059669",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)",
        warm: "0 4px 25px -5px rgba(249, 115, 22, 0.15), 0 10px 30px -5px rgba(249, 115, 22, 0.08)",
        glow: "0 0 20px rgba(249, 115, 22, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)",
      },
      animation: {
        "pulse-warm": "pulseWarm 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        "bounce-subtle": "bounceSubtle 0.6s ease-out",
      },
      keyframes: {
        pulseWarm: {
          "0%, 100%": {
            opacity: "1",
            boxShadow:
              "0 0 20px rgba(249, 115, 22, 0.3), 0 0 60px rgba(249, 115, 22, 0.1)",
          },
          "50%": {
            opacity: "0.85",
            boxShadow:
              "0 0 30px rgba(249, 115, 22, 0.5), 0 0 80px rgba(249, 115, 22, 0.2)",
          },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        bounceSubtle: {
          "0%": { transform: "scale(0.95)" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
