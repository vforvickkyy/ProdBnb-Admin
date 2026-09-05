import { Suspense } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UserDetailPage from "./page";

const { getMock, postMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

// React 18.3 (this project's pinned version) does not export `use` at all --
// Next.js's build pipeline bundles its own compatible React internally, so
// `use(params)` works in `next build`/`next dev`, but a plain Vitest run
// against the public `react` package needs the same thenable-unwrapping
// behavior polyfilled here. Mirrors React's own documented algorithm for a
// promise passed to `use()` (status/value/reason caching on the promise).
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  function usePolyfill<T>(promise: Promise<T> & { status?: string; value?: T; reason?: unknown }): T {
    if (promise.status === "fulfilled") return promise.value as T;
    if (promise.status === "rejected") throw promise.reason;
    if (promise.status === undefined) {
      promise.status = "pending";
      promise.then(
        (v) => {
          promise.status = "fulfilled";
          promise.value = v;
        },
        (e) => {
          promise.status = "rejected";
          promise.reason = e;
        }
      );
    }
    throw promise;
  }
  return { ...actual, use: usePolyfill };
});

vi.mock("@/components/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: postMock } };
});

function jsonOk(data: unknown) {
  return Promise.resolve({ data: { data }, error: undefined, response: { status: 200 } });
}
function jsonOkPaginated(rows: unknown[]) {
  return Promise.resolve({ data: { data: rows, meta: { page: 1, pageSize: 5, total: rows.length } }, error: undefined, response: { status: 200 } });
}

const baseUser = {
  id: "u1",
  first_name: "Ann",
  last_name: "Lee",
  avatar_url: null,
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  roles: ["host"],
  email: "ann@example.com",
  last_sign_in_at: null,
  locations_count: 1,
  bookings_count: 2,
};

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's cached "/v1/admin/users/u1" response from leaking
// into the next (same pattern as useAdminGate.test.ts).
function renderPage(id = "u1") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Suspense fallback={<div>Resolving route…</div>}>
        <UserDetailPage params={Promise.resolve({ id })} />
      </Suspense>
    </SWRConfig>
  );
}

describe("User detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseUser);
      return jsonOkPaginated([]);
    });
  });

  it("shows a loading state before the detail resolves, then the profile", async () => {
    let resolveDetail!: (v: unknown) => void;
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return new Promise((resolve) => (resolveDetail = resolve));
      return jsonOkPaginated([]);
    });

    renderPage();
    await waitFor(() => expect(screen.queryByText("Resolving route…")).not.toBeInTheDocument());
    expect(screen.queryByText("Ann Lee")).not.toBeInTheDocument();

    resolveDetail({ data: { data: baseUser }, error: undefined, response: { status: 200 } });
    expect(await screen.findByText("Ann Lee")).toBeInTheDocument();
  });

  it("shows an error state when the detail fetch fails", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return Promise.resolve({ data: undefined, error: { error: { message: "User not found." } }, response: { status: 404 } });
      return jsonOkPaginated([]);
    });

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("User not found.");
  });

  it("renders profile fields plus related locations, bookings, and audit history for a host", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseUser);
      if (path === "/locations") return jsonOkPaginated([{ id: "l1", title: "Rooftop Studio", city: "Mumbai", country: "India", status: "published" }]);
      if (path === "/bookings")
        return jsonOkPaginated([{ id: "b1", location: { title: "Rooftop Studio" }, status: "confirmed", start_at: "2026-02-01T10:00:00Z" }]);
      if (path === "/audit-log")
        return jsonOkPaginated([
          { id: "a1", action: "ADMIN_SUSPENDED_USER", target_type: "user", target_id: "u1", reason: "Test reason", created_at: "2026-01-05T00:00:00Z" },
        ]);
      return jsonOkPaginated([]);
    });

    renderPage();

    expect(await screen.findByText("ann@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Rooftop Studio").length).toBeGreaterThan(0);
    expect(screen.getByText(/admin suspended user/i)).toBeInTheDocument();
    expect(screen.getByText(/Test reason/)).toBeInTheDocument();
  });

  it("does not show a Locations section for a user without the host role", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk({ ...baseUser, roles: ["booker"] });
      return jsonOkPaginated([]);
    });

    renderPage();
    await screen.findByText("Ann Lee");
    expect(screen.queryByRole("heading", { name: "Locations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bookings hosted" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bookings made" })).toBeInTheDocument();
  });

  it("requires a reason before suspending, and calls the suspend endpoint", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ data: { data: { ...baseUser, status: "suspended" } }, error: undefined, response: { status: 200 } });

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Suspend" }));

    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Suspend" });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Reason"), "Repeated policy violations");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(postMock).toHaveBeenCalledWith(
      "/users/{id}/suspend",
      expect.objectContaining({ params: { path: { id: "u1" } }, body: { reason: "Repeated policy violations" } })
    );
    expect(toastSuccessMock).toHaveBeenCalled();
  });
});
