import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import HostsPage from "./page";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});

// SWR's default cache is a module-level singleton; every test in this file
// uses the same (empty) search params and therefore the same cache key, so
// a fresh provider per render keeps one test's response from leaking into
// the next (same pattern as useAdminGate.test.ts).
function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <HostsPage />
    </SWRConfig>
  );
}

describe("Hosts list page", () => {
  it("always requests role=host, with no role selector in the UI", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "h1",
            first_name: "Ravi",
            last_name: "Kumar",
            avatar_url: null,
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            roles: ["host"],
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      },
      error: undefined,
      response: { status: 200 },
    });

    renderPage();

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/users", expect.objectContaining({ params: { query: expect.objectContaining({ role: "host" }) } }));
    expect(screen.queryByRole("combobox", { name: "Filter by role" })).not.toBeInTheDocument();
  });

  it("shows a View link per row and no inline destructive actions", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "h1",
            first_name: "Ravi",
            last_name: "Kumar",
            avatar_url: null,
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            roles: ["host"],
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      },
      error: undefined,
      response: { status: 200 },
    });

    renderPage();

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/hosts/h1");
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });

  it("supports search and status filtering", async () => {
    getMock.mockResolvedValue({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0 } },
      error: undefined,
      response: { status: 200 },
    });

    renderPage();

    expect(await screen.findByText("No hosts match these filters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search hosts by name")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeInTheDocument();
  });
});
