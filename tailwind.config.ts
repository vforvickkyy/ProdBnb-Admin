import type { Config } from "tailwindcss";

/**
 * Theming (Admin Console 2): every palette the console uses is a CSS variable (src/app/globals.css),
 * with a hand-tuned dark value per shade. `class="dark"` on <html> swaps them all at once, so the
 * same `bg-white text-slate-900` markup renders as a dark surface with light text -- no per-component
 * `dark:` variants to forget. Contrast of every text shade on every surface was checked against WCAG
 * AA in both themes.
 *
 * Console 3 (Framer-style): neutral greys, `canvas` for the page behind the cards, and `accent` -- the
 * interface blue for primary actions, focus and selection. `brand` (amber) is kept for the logo and
 * anything that must match the iOS app, but no longer drives the interface.
 *
 * `ink` and `snow` never flip with the theme (fixed dark chrome / white text on a fill).
 *
 * Brand tokens shared with the iOS app (ProdBnb.IOS DesignSystem/Colors.swift):
 *   brand -- "warm cinematic amber", Booker Mode's accent   (#C28014 light-mode value)
 *   host  -- "professional teal", Host Mode's accent         (#17858A light-mode value)
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function themed(name: string): Record<string, string> {
  return Object.fromEntries(SHADES.map((shade) => [shade, `rgb(var(--${name}-${shade}) / <alpha-value>)`]));
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      black: "#000000",
      white: "rgb(var(--white) / <alpha-value>)",
      canvas: "rgb(var(--canvas) / <alpha-value>)",
      snow: "#ffffff",
      slate: themed("slate"),
      red: themed("red"),
      green: themed("green"),
      amber: themed("amber"),
      blue: themed("blue"),
      accent: themed("accent"),
      brand: themed("brand"),
      host: themed("host"),
      ink: {
        300: "#d1d5db",
        400: "#9ca3af",
        500: "#6b7280",
        700: "#2b3340",
        800: "#1f2631",
        900: "#151b24",
        950: "#0b0f17",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        pop: "0 8px 30px -6px rgb(0 0 0 / 0.25), 0 2px 6px -2px rgb(0 0 0 / 0.12)",
      },
      keyframes: {
        "page-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "none" } },
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "none" } },
      },
      animation: {
        "page-in": "page-in 180ms ease-out both",
        "fade-in": "fade-in 150ms ease-out both",
        "scale-in": "scale-in 150ms ease-out both",
        "slide-in-left": "slide-in-left 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
