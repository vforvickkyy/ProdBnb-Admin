import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import BookingDetailPage from "./page";

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

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
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, adminApi: { GET: getMock, POST: vi.fn() } };
});

function jsonOk(data: unknown) {
  return Promise.resolve({ data: { data }, error: undefined, response: { status: 200 } });
}
function jsonOkPaginated(rows: unknown[]) {
  return Promise.resolve({ data: { data: rows, meta: { page: 1, pageSize: 20, total: rows.length } }, error: undefined, response: { status: 200 } });
}

const baseBooking = {
  id: "b1",
  location: { id: "l1", title: "Rooftop Studio", city: "Mumbai", timezone: "Asia/Kolkata", host_id: "h1", host: { first_name: "Ravi", last_name: "Kumar" } },
  booker_id: "u1",
  booker: { first_name: "Ann", last_name: "Lee" },
  booking_type: "hourly",
  start_at: "2026-02-01T09:00:00Z",
  end_at: "2026-02-01T10:00:00Z",
  status: "confirmed",
  pricing: { base_amount_minor_units: 10000, platform_fee_minor_units: 500, tax_minor_units: 200, discount_minor_units: 0, total_amount_minor_units: 10700, currency: "INR" },
  payments: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: null,
};

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's cached response from leaking into the next.
function renderPage(id = "b1") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Suspense fallback={<div>Resolving route…</div>}>
        <BookingDetailPage params={Promise.resolve({ id })} />
      </Suspense>
    </SWRConfig>
  );
}

describe("Booking detail page — notification delivery panel integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path: string) => {
      if (path === "/bookings/{id}") return jsonOk(baseBooking);
      if (path === "/audit-log") return jsonOkPaginated([]);
      if (path === "/notifications/delivery-attempts") return jsonOkPaginated([]);
      return jsonOkPaginated([]);
    });
  });

  it("renders the NotificationDeliveryPanel, scoped to this booking's id", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Rooftop Studio" })).toBeInTheDocument());

    expect(await screen.findByRole("heading", { name: "Notification delivery" })).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(
      "/notifications/delivery-attempts",
      expect.objectContaining({ params: { query: expect.objectContaining({ booking_id: "b1" }) } })
    );
  });

  it("shows the panel's own empty state when there are no delivery attempts, without breaking the rest of the page", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Notification delivery" });
    expect(screen.getByText("No delivery attempts recorded yet")).toBeInTheDocument();
  });

  it("wraps the loading skeleton in role=status while the detail fetch is pending", async () => {
    let resolveDetail!: (v: unknown) => void;
    getMock.mockImplementation((path: string) => {
      if (path === "/bookings/{id}") return new Promise((resolve) => (resolveDetail = resolve));
      return jsonOkPaginated([]);
    });

    renderPage();
    await waitFor(() => expect(screen.queryByText("Resolving route…")).not.toBeInTheDocument());
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

    resolveDetail({ data: { data: baseBooking }, error: undefined, response: { status: 200 } });
    expect(await screen.findByRole("heading", { name: "Rooftop Studio" })).toBeInTheDocument();
  });

  describe("admin booking actions", () => {
    async function renderWithRole(permissions: string[], status = "requested") {
      getMock.mockImplementation((path: string) => {
        if (path === "/me") return Promise.resolve({ data: { data: { user_id: "u", email: null, first_name: null, last_name: null, team_role: "support", permissions } }, error: undefined, response: { status: 200 } });
        if (path === "/bookings/{id}") return Promise.resolve({ data: { data: { ...baseBooking, status } }, error: undefined, response: { status: 200 } });
        return Promise.resolve({ data: { data: [], meta: { page: 1, pageSize: 20, total: 0 } }, error: undefined, response: { status: 200 } });
      });
      renderPage();
      await screen.findByRole("heading", { level: 1 });
    }

    it("offers confirm/reject/cancel to an admin with bookings.manage", async () => {
      await renderWithRole(["bookings.view", "bookings.manage"]);
      expect(await screen.findByRole("button", { name: "Confirm" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    });

    it("offers no actions to an admin without bookings.manage", async () => {
      await renderWithRole(["bookings.view"]);
      await screen.findByText("Pricing snapshot");
      expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    });
  });
});

