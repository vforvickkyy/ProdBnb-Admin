import { Suspense } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LocationDetailPage from "./page";

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

const baseLocation = {
  id: "l1",
  host_id: "h1",
  title: "Rooftop Studio",
  description: "A sunny rooftop space.",
  address_line1: "12 MG Road",
  address_line2: null,
  city: "Mumbai",
  region: "MH",
  country: "India",
  postal_code: "400001",
  latitude: null,
  longitude: null,
  capacity: 20,
  timezone: "Asia/Kolkata",
  instant_booking_enabled: true,
  status: "published",
  moderation_reason: null,
  suspended_by_host_suspension: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  categories: [{ id: "c1", name: "Photography" }],
  amenities: [{ id: "a1", name: "WiFi" }],
  use_cases: [{ id: "u1", name: "Shoots" }],
  media: [{ id: "m1", media_type: "photo", url: "https://media.example.com/m1.jpg", position: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
  host: { id: "h1", first_name: "Ravi", last_name: "Kumar", avatar_url: null },
  booking_options: [{ type: "hourly", amount_minor_units: 50000, currency: "INR" }],
};

// SWR's default cache is a module-level singleton; a fresh provider per
// render keeps one test's cached response from leaking into the next.
function renderPage(id = "l1") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Suspense fallback={<div>Resolving route…</div>}>
        <LocationDetailPage params={Promise.resolve({ id })} />
      </Suspense>
    </SWRConfig>
  );
}

describe("Location detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return jsonOk(baseLocation);
      if (path === "/locations/{id}/gallery") return jsonOk({ general: baseLocation.media, sections: [] });
      return jsonOkPaginated([]);
    });
  });

  it("shows a loading state before the detail resolves, then the location", async () => {
    let resolveDetail!: (v: unknown) => void;
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return new Promise((resolve) => (resolveDetail = resolve));
      return jsonOkPaginated([]);
    });

    renderPage();
    await waitFor(() => expect(screen.queryByText("Resolving route…")).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Rooftop Studio" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();

    resolveDetail({ data: { data: baseLocation }, error: undefined, response: { status: 200 } });
    expect(await screen.findByRole("heading", { name: "Rooftop Studio" })).toBeInTheDocument();
  });

  it("shows an error state when the detail fetch fails", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return Promise.resolve({ data: undefined, error: { error: { message: "Location not found." } }, response: { status: 404 } });
      return jsonOkPaginated([]);
    });

    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Location not found.");
  });

  it("renders host information directly when the backend already returns a host", async () => {
    renderPage();
    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    // The fallback endpoint must never be called when host data is already present.
    expect(getMock).not.toHaveBeenCalledWith("/users/{id}", expect.anything());
  });

  it("falls back to GET /v1/admin/users/{host_id} when host is null but host_id is present", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return jsonOk({ ...baseLocation, host: null, status: "rejected" });
      if (path === "/users/{id}") return jsonOk({ id: "h1", first_name: "Ravi", last_name: "Kumar", email: "ravi@example.com", status: "active", roles: ["host"] });
      return jsonOkPaginated([]);
    });

    renderPage();

    expect(await screen.findByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText("ravi@example.com")).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith("/users/{id}", expect.objectContaining({ params: { path: { id: "h1" } } }));
  });

  it("does not call the host fallback for the normal case where host is already present", async () => {
    renderPage();
    await screen.findByText("Ravi Kumar");
    expect(getMock).not.toHaveBeenCalledWith("/users/{id}", expect.anything());
  });

  it("renders media via the safe public url and never exposes a storage key", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Media" });
    // Decorative media thumbnails use alt="" by design, so they're excluded
    // from the accessibility tree (role query) -- query the DOM directly.
    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", "https://media.example.com/m1.jpg");
    expect(document.body.innerHTML).not.toContain("storage_key");
  });

  it("shows the host-suspension badge distinctly from a policy-violation suspension", async () => {
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return jsonOk({ ...baseLocation, status: "suspended", suspended_by_host_suspension: true });
      return jsonOkPaginated([]);
    });

    renderPage();
    expect(await screen.findByText("Host account suspended")).toBeInTheDocument();
  });

  it("requires a reason before rejecting, and calls the reject endpoint", async () => {
    const user = userEvent.setup();
    getMock.mockImplementation((path: string) => {
      if (path === "/locations/{id}") return jsonOk({ ...baseLocation, status: "submitted" });
      return jsonOkPaginated([]);
    });
    postMock.mockResolvedValue({ data: { data: { ...baseLocation, status: "rejected" } }, error: undefined, response: { status: 200 } });

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Reject" }));

    const dialog = await screen.findByRole("dialog");
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Reason"), "Incomplete listing information");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(postMock).toHaveBeenCalledWith(
      "/locations/{id}/reject",
      expect.objectContaining({ params: { path: { id: "l1" } }, body: { reason: "Incomplete listing information" } })
    );
    expect(toastSuccessMock).toHaveBeenCalled();
  });
});
