import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SystemPage from "./page";

const { getMock, getReadinessMock } = vi.hoisted(() => ({ getMock: vi.fn(), getReadinessMock: vi.fn() }));

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});
vi.mock("@/lib/health", () => ({ getReadiness: getReadinessMock }));

function report(liveChecks: boolean) {
  return {
    checked_at: "2026-11-15T10:00:00Z",
    live_checks: liveChecks,
    deployment: {
      node_env: "production",
      vercel_env: "production",
      region: "sin1",
      commit_sha: "abcdef1234567",
      commit_ref: "main",
      commit_message: "Ship it",
      deployment_url: null,
    },
    integrations: [
      {
        id: "supabase",
        name: "Supabase",
        purpose: "Database, authentication, realtime",
        status: liveChecks ? "ok" : "unchecked",
        detail: liveChecks ? "Database reachable with both the anon and service-role keys." : "Configured. Run checks to test connectivity.",
        latency_ms: liveChecks ? 42 : null,
        settings: [
          { key: "SUPABASE_URL", kind: "public", set: true, display: "https://example.supabase.co" },
          { key: "SUPABASE_SERVICE_ROLE_KEY", kind: "secret", set: true, display: null },
        ],
      },
      {
        id: "apns",
        name: "Apple Push (APNs)",
        purpose: "iOS push notifications",
        status: "disabled",
        detail: "Push is off.",
        latency_ms: null,
        settings: [{ key: "APNS_PRIVATE_KEY", kind: "secret", set: false, display: null }],
      },
    ],
  };
}

function jsonOk(data: unknown) {
  return Promise.resolve({ data: { data }, error: undefined, response: { status: 200 } });
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SystemPage />
    </SWRConfig>
  );
}

describe("Integrations & health page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((_path: string, init: { params: { query: { check: string } } }) =>
      jsonOk(report(init.params.query.check === "true"))
    );
    getReadinessMock.mockResolvedValue("ready");
  });

  it("shows backend readiness", async () => {
    renderPage();
    expect(await screen.findByText("Ready")).toHaveClass("bg-green-50");
  });

  it("shows Not ready when the readiness check fails", async () => {
    getReadinessMock.mockResolvedValue("not-ready");
    renderPage();
    expect(await screen.findByText("Not ready")).toHaveClass("bg-red-50");
  });

  it("lists each integration's keys without ever showing a secret value", async () => {
    renderPage();
    expect(await screen.findByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("https://example.supabase.co")).toBeInTheDocument();
    expect(screen.getByText("Set · hidden")).toBeInTheDocument();
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("starts with configuration only and runs live checks on demand", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Not checked")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/system/integrations", { params: { query: { check: "false" } } });

    await user.click(screen.getByRole("button", { name: "Run live checks" }));

    await waitFor(() => expect(getMock).toHaveBeenCalledWith("/system/integrations", { params: { query: { check: "true" } } }));
    expect(await screen.findByText("✓ Working")).toBeInTheDocument();
    expect(screen.getByText(/42 ms/)).toBeInTheDocument();
  });

  it("links out to Vercel for editing keys", async () => {
    renderPage();
    await screen.findByText("Supabase");
    expect(screen.getByRole("link", { name: /Edit backend keys in Vercel/ })).toHaveAttribute("href", expect.stringContaining("vercel.com"));
  });
});
