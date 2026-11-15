import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import UsersPage from "./page";

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

describe("Users list page", () => {
  it("shows a View link per row and no inline suspend/restore controls (Phase 14-B1 consolidation)", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: "u1",
            first_name: "Ann",
            last_name: "Lee",
            avatar_url: null,
            status: "active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            roles: ["booker"],
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1 },
      },
      error: undefined,
      response: { status: 200 },
    });

    render(<UsersPage />);

    expect(await screen.findByText("Ann Lee")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/users/u1");
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });
});
