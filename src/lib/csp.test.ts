import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "./csp";

describe("buildCsp", () => {
  const csp = buildCsp("abc123", { supabaseUrl: "https://x.supabase.co/auth", apiBaseUrl: "https://api.example.com/v1" });

  it("allows Next's inline scripts only through the per-request nonce", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("limits connections to this app, Supabase, the backend, R2 uploads and Google Maps (origins only)", () => {
    expect(csp).toContain(
      "connect-src 'self' https://x.supabase.co https://api.example.com https://*.r2.cloudflarestorage.com https://maps.googleapis.com https://*.googleapis.com https://*.gstatic.com"
    );
  });

  it("keeps framing and plugins locked down", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("never reuses a nonce", () => {
    expect(newNonce()).not.toBe(newNonce());
  });
});
