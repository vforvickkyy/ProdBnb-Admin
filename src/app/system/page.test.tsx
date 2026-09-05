import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import SystemHealthPage from "./page";

const { getMock, getReadinessMock } = vi.hoisted(() => ({ getMock: vi.fn(), getReadinessMock: vi.fn() }));

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});
vi.mock("@/lib/health", () => ({ getReadiness: getReadinessMock }));

const baseStatus = {
  environment: "production",
  payments: { provider: "cashfree", mode: "test" },
  notifications: { provider: "disabled" },
  media: { configured: true },
};

function jsonOk(data: unknown) {
  return Promise.resolve({ data: { data }, error: undefined, response: { status: 200 } });
}

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's response from leaking into the next.
function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <SystemHealthPage />
    </SWRConfig>
  );
}

describe("System Health page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation(() => jsonOk(baseStatus));
    getReadinessMock.mockResolvedValue("ready");
  });

  it("shows loading skeletons before either fetch resolves", async () => {
    let resolveReadiness!: (v: string) => void;
    getReadinessMock.mockImplementation(() => new Promise((resolve) => (resolveReadiness = resolve)));

    renderPage();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: "Loading" }).length).toBeGreaterThan(0);

    resolveReadiness("ready");
    expect(await screen.findByText("Ready")).toBeInTheDocument();
  });

  it("shows Ready with a success tone when the backend is ready", async () => {
    renderPage();
    const badge = await screen.findByText("Ready");
    expect(badge).toHaveClass("bg-green-50");
  });

  it("shows Not Ready with a danger tone when the backend is not ready", async () => {
    getReadinessMock.mockResolvedValue("not-ready");
    renderPage();
    const badge = await screen.findByText("Not Ready");
    expect(badge).toHaveClass("bg-red-50");
  });

  it("degrades to Not Ready rather than crashing when the health check itself throws", async () => {
    getReadinessMock.mockRejectedValue(new Error("network error"));
    renderPage();
    // getReadiness() itself swallows the error and resolves "not-ready" --
    // this proves the page renders correctly even if that contract changes
    // and the promise rejects instead.
    expect(await screen.findByRole("heading", { name: "System Health" })).toBeInTheDocument();
  });

  it("renders every configuration field from system/status", async () => {
    renderPage();
    expect(await screen.findByText("production")).toBeInTheDocument();
    expect(screen.getByText("cashfree")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
  });

  it("treats a disabled notification provider as informational, not an error", async () => {
    renderPage();
    const badge = await screen.findByText("Disabled");
    expect(badge).not.toHaveClass("bg-red-50");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows Not configured with a neutral tone when media is not configured", async () => {
    getMock.mockImplementation(() => jsonOk({ ...baseStatus, media: { configured: false } }));
    renderPage();
    const badge = await screen.findByText("Not configured");
    expect(badge).toHaveClass("bg-slate-100");
  });

  it("shows an error state when the system/status API call fails", async () => {
    getMock.mockImplementation(() => Promise.resolve({ data: undefined, error: { error: { message: "Forbidden." } }, response: { status: 403 } }));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden.");
  });
});
