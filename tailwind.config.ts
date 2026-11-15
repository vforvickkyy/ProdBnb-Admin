import type { Config } from "tailwindcss";

/**
 * Brand tokens shared with the iOS app (ProdBnb.IOS DesignSystem/Colors.swift):
 *   brand -- "warm cinematic amber", Booker Mode's accent   (#C28014 light-mode value)
 *   host  -- "professional teal", Host Mode's accent         (#17858A light-mode value)
 * The admin console keeps neutral slate for chrome and uses these sparingly, as accents.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf7ec",
          100: "#f9ebcf",
          200: "#f2d39a",
          300: "#e9b75f",
          400: "#de9c33",
          500: "#c28014",
          600: "#a0670f",
          700: "#7d4f0d",
          800: "#5c3a0c",
          900: "#3f280a",
        },
        host: {
          50: "#ecf8f8",
          100: "#cfeeee",
          500: "#17858a",
          600: "#126b6f",
          700: "#0e5457",
        },
      },
    },
  },
  plugins: [],
};

export default config;
