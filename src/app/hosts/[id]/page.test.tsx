import { Suspense } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HostDetailPage from "./page";

const { getMock, postMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

// See src/app/users/[id]/page.test.tsx for why `use` needs a polyfill under
// this project's pinned React 18.3 when running outside Next's own build.
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

const baseHost = {
  id: "h1",
  first_name: "Ravi",
  last_name: "Kumar",
  avatar_url: null,
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  roles: ["host"],
  email: "ravi@example.com",
  last_sign_in_at: null,
  locations_count: 2,
  bookings_count: 0,
};

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's cached response from leaking into the next.
function renderPage(id = "h1") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Suspense fallback={<div>Resolving route…</div>}>
        <HostDetailPage params={Promise.resolve({ id })} />
      </Suspense>
    </SWRConfig>
  );
}

describe("Host detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseHost);
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
    expect(screen.queryByText("Ravi Kumar")).not.toBeInTheDocument();

    resolveDetail({ data: { data: baseHost }, error: undefined, response: { status: 200 } });
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
  });

  it("shows an error state when the detail fetch fails", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return Promise.resolve({ data: undefined, error: { error: { message: "Host not found." } }, response: { status: 404 } });
      return jsonOkPaginated([]);
    });

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Host not found.");
  });

  it("shows an empty state when the host has no locations, bookings, or audit history", async () => {
    renderPage();
    expect(await screen.findByText("This host has no locations.")).toBeInTheDocument();
    expect(screen.getAllByText(/This host has no locations\.|no bookings/i).length).toBeGreaterThan(0);
    expect(screen.getByText("No admin actions recorded for this host.")).toBeInTheDocument();
  });

  it("tallies the location status breakdown from the host's own locations, and distinguishes host-suspension from policy suspension", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseHost);
      if (path === "/locations")
        return jsonOkPaginated([
          { id: "l1", title: "Rooftop Studio", city: "Mumbai", country: "India", status: "published", suspended_by_host_suspension: false },
          { id: "l2", title: "Garden Hall", city: "Pune", country: "India", status: "suspended", suspended_by_host_suspension: true },
          { id: "l3", title: "Loft Space", city: "Delhi", country: "India", status: "suspended", suspended_by_host_suspension: false },
        ]);
      return jsonOkPaginated([]);
    });

    renderPage();

    expect(await screen.findByText("Rooftop Studio")).toBeInTheDocument();
    expect(screen.getByText("Host account suspended")).toBeInTheDocument();
    expect(screen.getByText("Policy violation")).toBeInTheDocument();

    const breakdown = screen.getByText("Location status breakdown").closest("section")!;
    expect(within(breakdown).getByText("1")).toBeInTheDocument(); // published: 1
    expect(within(breakdown).getByText("2")).toBeInTheDocument(); // suspended: 2
  });

  it("shows the bookings-hosted total as the host activity summary", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseHost);
      if (path === "/bookings")
        return Promise.resolve({
          data: { data: [{ id: "b1", location: { title: "Rooftop Studio" }, status: "confirmed", start_at: "2026-02-01T10:00:00Z" }], meta: { page: 1, pageSize: 5, total: 7 } },
          error: undefined,
          response: { status: 200 },
        });
      return jsonOkPaginated([]);
    });

    renderPage();
    await screen.findByText("Ravi Kumar");
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("requires a reason before suspending, and calls the suspend endpoint", async () => {
    const user = userEvent.setup();
    postMock.mockResolvedValue({ data: { data: { ...baseHost, status: "suspended" } }, error: undefined, response: { status: 200 } });

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
      expect.objectContaining({ params: { path: { id: "h1" } }, body: { reason: "Repeated policy violations" } })
    );
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("restores without requiring a reason", async () => {
    const user = userEvent.setup();
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk({ ...baseHost, status: "suspended" });
      return jsonOkPaginated([]);
    });
    postMock.mockResolvedValue({ data: { data: { ...baseHost, status: "active" } }, error: undefined, response: { status: 200 } });

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Restore" }));

    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Restore" });
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(postMock).toHaveBeenCalledWith("/users/{id}/restore", expect.objectContaining({ params: { path: { id: "h1" } }, body: {} }));
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("links each location row to its Location Detail page", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/users/{id}") return jsonOk(baseHost);
      if (path === "/locations")
        return jsonOkPaginated([{ id: "l1", title: "Rooftop Studio", city: "Mumbai", country: "India", status: "published", suspended_by_host_suspension: false }]);
      return jsonOkPaginated([]);
    });

    renderPage();
    await screen.findByText("Rooftop Studio");
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/locations/l1");
  });
});
