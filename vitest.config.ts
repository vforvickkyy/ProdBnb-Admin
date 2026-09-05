import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    // Unlike Next's own dev/build, Vitest doesn't read .env.local -- these
    // are dummy, non-secret placeholders (no real Supabase project) purely
    // so src/lib/supabase.ts's createClient() call doesn't throw
    // "supabaseUrl is required" at module import time. No test in this
    // suite makes a real network call through this client.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_API_BASE_URL: "https://test-api.example.com",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
