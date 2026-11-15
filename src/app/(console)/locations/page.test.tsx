import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocationsPage from "./page";

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

describe("Locations list page", () => {
  it("shows a View link per row and no inline moderation controls (Phase 14-B1 consolidation)", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "l1",
            host_id: "h1",
            title: "Rooftop Studio",
            city: "Mumbai",
            country: "India",
            status: "submitted",
            moderation_reason: null,
            suspended_by_host_suspension: false,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      },
      error: undefined,
      response: { status: 200 },
    });

    render(<LocationsPage />);

    expect(await screen.findByText("Rooftop Studio")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/locations/l1");
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });
});
